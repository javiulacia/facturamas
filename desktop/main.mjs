import * as electronMain from 'electron/main'
import { spawn } from 'node:child_process'
import http from 'node:http'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { MongoMemoryServer } from 'mongodb-memory-server-core'

const { app, BrowserWindow, dialog, Menu, shell } = electronMain

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const FRONTEND_PORT = 5174
const BACKEND_PORT = 3001
const MONGO_PORT = 27027
const FRONTEND_URL = `http://127.0.0.1:${FRONTEND_PORT}`
const API_HEALTH_URL = `http://127.0.0.1:${BACKEND_PORT}/health`
const ROOT_DIR = path.resolve(__dirname, '..')
const APP_DISPLAY_NAME = 'Facturamas'
const APP_WEBSITE_URL = 'http://facturamas.es/'
const APP_LICENSE = 'MIT'
const VERSION_STATE_FILENAME = 'installed-version.json'
const DATA_BACKUP_DIRNAME = 'upgrade-backups'
const DATA_DIR_NAMES = ['mongo-data', 'pdfs', 'logos']
const MAX_UPGRADE_BACKUPS = 5

let mainWindow = null
let staticServer = null
let backendProcess = null
let mongoServer = null
let quitting = false

app.setName(APP_DISPLAY_NAME)

function getAppRootDir() {
  return app.isPackaged ? app.getAppPath() : __dirname
}

function getFrontendDistDir() {
  return path.join(getAppRootDir(), 'frontend-dist')
}

function getBackendExecutable() {
  const executableName = process.platform === 'win32' ? 'facturamas-backend.exe' : 'facturamas-backend'
  return path.join(getAppRootDir(), 'bin', executableName)
}

function getAppIconPath() {
  return path.join(getAppRootDir(), 'assets', 'app.png')
}

function sanitizeVersion(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9._-]/g, '-')
}

function getVersionStatePath(userDataDir) {
  return path.join(userDataDir, VERSION_STATE_FILENAME)
}

function readInstalledVersion(userDataDir) {
  try {
    const statePath = getVersionStatePath(userDataDir)
    if (!fs.existsSync(statePath)) {
      return ''
    }

    const state = JSON.parse(fs.readFileSync(statePath, 'utf8'))
    return typeof state.version === 'string' ? state.version : ''
  } catch (error) {
    console.warn('No se pudo leer la version instalada anterior:', error)
    return ''
  }
}

function writeInstalledVersion(userDataDir) {
  const state = {
    version: app.getVersion(),
    updatedAt: new Date().toISOString(),
  }

  fs.writeFileSync(getVersionStatePath(userDataDir), `${JSON.stringify(state, null, 2)}\n`)
}

function hasExistingUserData(userDataDir) {
  return DATA_DIR_NAMES.some((dirName) => {
    const sourcePath = path.join(userDataDir, dirName)
    return fs.existsSync(sourcePath) && fs.readdirSync(sourcePath).length > 0
  })
}

function cleanupOldUpgradeBackups(backupsRoot) {
  if (!fs.existsSync(backupsRoot)) {
    return
  }

  const backups = fs.readdirSync(backupsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const fullPath = path.join(backupsRoot, entry.name)
      return {
        name: entry.name,
        path: fullPath,
        createdAt: fs.statSync(fullPath).mtimeMs,
      }
    })
    .sort((left, right) => right.createdAt - left.createdAt)

  backups.slice(MAX_UPGRADE_BACKUPS).forEach((backup) => {
    fs.rmSync(backup.path, { recursive: true, force: true })
  })
}

function createUpgradeBackupIfNeeded(userDataDir) {
  const currentVersion = app.getVersion()
  const previousVersion = readInstalledVersion(userDataDir)

  if (previousVersion === currentVersion || !hasExistingUserData(userDataDir)) {
    return
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const fromVersion = sanitizeVersion(previousVersion || 'unknown')
  const toVersion = sanitizeVersion(currentVersion)
  const backupsRoot = path.join(userDataDir, DATA_BACKUP_DIRNAME)
  const backupDir = path.join(backupsRoot, `${timestamp}-from-${fromVersion}-to-${toVersion}`)

  fs.mkdirSync(backupDir, { recursive: true })

  DATA_DIR_NAMES.forEach((dirName) => {
    const sourcePath = path.join(userDataDir, dirName)
    if (!fs.existsSync(sourcePath)) {
      return
    }

    fs.cpSync(sourcePath, path.join(backupDir, dirName), {
      recursive: true,
      force: true,
      errorOnExist: false,
    })
  })

  fs.writeFileSync(
    path.join(backupDir, 'backup-info.json'),
    `${JSON.stringify({
      appName: APP_DISPLAY_NAME,
      fromVersion: previousVersion || null,
      toVersion: currentVersion,
      createdAt: new Date().toISOString(),
      userDataDir,
    }, null, 2)}\n`
  )

  cleanupOldUpgradeBackups(backupsRoot)
}

function requestOk(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (response) => {
      response.resume()
      resolve(response.statusCode && response.statusCode >= 200 && response.statusCode < 500)
    })

    req.on('error', () => resolve(false))
    req.setTimeout(1500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function waitForServices(timeoutMs = 120000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const [frontendReady, backendReady] = await Promise.all([
      requestOk(FRONTEND_URL),
      requestOk(API_HEALTH_URL),
    ])

    if (frontendReady && backendReady) {
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  return false
}

function ensureFrontendBuildExists() {
  if (!fs.existsSync(path.join(getFrontendDistDir(), 'index.html'))) {
    throw new Error('No existe desktop/frontend-dist. Ejecuta `npm run build:frontend` dentro de desktop.')
  }
}

function startStaticServer() {
  if (staticServer) {
    return staticServer
  }

  ensureFrontendBuildExists()

  staticServer = http.createServer((request, response) => {
    const requestPath = request.url?.split('?')[0] || '/'
    const relativePath = requestPath === '/' ? '/index.html' : requestPath
    const frontendDistDir = getFrontendDistDir()
    let filePath = path.join(frontendDistDir, relativePath)

    if (!filePath.startsWith(frontendDistDir)) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(frontendDistDir, 'index.html')
    }

    const extension = path.extname(filePath)
    const contentType = (
      {
        '.html': 'text/html; charset=utf-8',
        '.js': 'application/javascript; charset=utf-8',
        '.css': 'text/css; charset=utf-8',
        '.svg': 'image/svg+xml',
        '.json': 'application/json; charset=utf-8',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.ico': 'image/x-icon',
      }[extension] || 'application/octet-stream'
    )

    response.writeHead(200, { 'Content-Type': contentType })
    fs.createReadStream(filePath).pipe(response)
  })

  staticServer.listen(FRONTEND_PORT, '127.0.0.1')
  return staticServer
}

async function startMongo(userDataDir) {
  if (mongoServer) {
    return mongoServer
  }

  const mongoDataDir = path.join(userDataDir, 'mongo-data')
  fs.mkdirSync(mongoDataDir, { recursive: true })

  mongoServer = await MongoMemoryServer.create({
    instance: {
      port: MONGO_PORT,
      dbName: 'facturamas',
      dbPath: mongoDataDir,
      ip: '127.0.0.1',
    },
  })

  return mongoServer
}

function startBackend(userDataDir) {
  if (backendProcess) {
    return backendProcess
  }

  const pdfDir = path.join(userDataDir, 'pdfs')
  const logoDir = path.join(userDataDir, 'logos')
  fs.mkdirSync(pdfDir, { recursive: true })
  fs.mkdirSync(logoDir, { recursive: true })
  const binaryPath = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    process.env.PATH || '',
  ].filter(Boolean).join(path.delimiter)
  const env = {
    ...process.env,
    PATH: binaryPath,
    MONGODB_URI: `mongodb://127.0.0.1:${MONGO_PORT}`,
    DB_NAME: 'facturamas',
    SERVER_PORT: String(BACKEND_PORT),
    PDF_OUTPUT_DIR: pdfDir,
    LOGO_STORAGE_DIR: logoDir,
  }

  if (app.isPackaged) {
    const backendExecutable = getBackendExecutable()
    if (!fs.existsSync(backendExecutable)) {
      throw new Error(`No se ha encontrado el binario del backend en ${backendExecutable}`)
    }

    backendProcess = spawn(backendExecutable, [], {
      stdio: 'inherit',
      env,
    })
  } else {
    backendProcess = spawn('go', ['run', 'cmd/main.go'], {
      cwd: path.join(ROOT_DIR, 'backend'),
      stdio: 'inherit',
      env,
    })
  }

  backendProcess.on('exit', () => {
    backendProcess = null
  })

  return backendProcess
}

async function ensureServices() {
  startStaticServer()

  const userDataDir = app.getPath('userData')
  createUpgradeBackupIfNeeded(userDataDir)
  await startMongo(userDataDir)
  startBackend(userDataDir)

  const ready = await waitForServices(120000)
  if (!ready) {
    throw new Error('No se pudo iniciar la version desktop dentro del tiempo esperado.')
  }

  writeInstalledVersion(userDataDir)
}

async function shutdownServices() {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM')
  }

  if (staticServer) {
    staticServer.close()
    staticServer = null
  }

  if (mongoServer) {
    await mongoServer.stop()
    mongoServer = null
  }
}

async function showAboutDialog() {
  const result = await dialog.showMessageBox(mainWindow || undefined, {
    type: 'info',
    title: `Acerca de ${APP_DISPLAY_NAME}`,
    message: APP_DISPLAY_NAME,
    detail: [
      `Version: ${app.getVersion()}`,
      `Licencia: ${APP_LICENSE}`,
      '',
      'Aplicacion de escritorio open source para facturas, presupuestos, clientes y programaciones recurrentes.',
      '',
      `Web: ${APP_WEBSITE_URL}`,
    ].join('\n'),
    icon: getAppIconPath(),
    buttons: ['Abrir web', 'Cerrar'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  })

  if (result.response === 0) {
    await shell.openExternal(APP_WEBSITE_URL)
  }
}

function createMenu() {
  const template = [
    {
      label: APP_DISPLAY_NAME,
      submenu: [
        { label: `Acerca de ${APP_DISPLAY_NAME}`, click: showAboutDialog },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Forzar recarga' },
        { role: 'toggleDevTools', label: 'Herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: `Acerca de ${APP_DISPLAY_NAME}`,
          click: showAboutDialog,
        },
        { type: 'separator' },
        {
          label: 'Abrir en navegador',
          click: () => shell.openExternal(FRONTEND_URL),
        },
        {
          label: 'Web de Facturamas',
          click: () => shell.openExternal(APP_WEBSITE_URL),
        },
      ],
    },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function createContextMenu(event, params) {
  const menuItems = []

  if (params.isEditable) {
    menuItems.push(
      { role: 'undo', label: 'Deshacer' },
      { role: 'redo', label: 'Rehacer' },
      { type: 'separator' },
      { role: 'cut', label: 'Cortar' },
      { role: 'copy', label: 'Copiar', enabled: params.selectionText.length > 0 },
      { role: 'paste', label: 'Pegar' },
      { role: 'selectAll', label: 'Seleccionar todo' }
    )
  } else if (params.selectionText.length > 0) {
    menuItems.push({ role: 'copy', label: 'Copiar' })
  }

  if (menuItems.length === 0) {
    return
  }

  const menu = Menu.buildFromTemplate(menuItems)
  menu.popup({ window: mainWindow })
}

async function createWindow() {
  createMenu()

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 390,
    minHeight: 720,
    backgroundColor: '#f9fafb',
    title: APP_DISPLAY_NAME,
    icon: getAppIconPath(),
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('context-menu', createContextMenu)

  try {
    await ensureServices()
    await mainWindow.loadURL(FRONTEND_URL)
  } catch (error) {
    dialog.showErrorBox(
      'No se pudo abrir Facturamas',
      `${error.message}\n\nRevisa que los servicios locales puedan iniciarse y vuelve a intentarlo.`
    )
    app.quit()
  }
}

app.whenReady().then(createWindow)

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await createWindow()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async (event) => {
  if (quitting) {
    return
  }

  quitting = true
  event.preventDefault()

  await shutdownServices()
  app.exit(0)
})
