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

let mainWindow = null
let staticServer = null
let backendProcess = null
let mongoServer = null
let quitting = false

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
  await startMongo(userDataDir)
  startBackend(userDataDir)

  const ready = await waitForServices(120000)
  if (!ready) {
    throw new Error('No se pudo iniciar la version desktop dentro del tiempo esperado.')
  }
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

function createMenu() {
  const template = [
    {
      label: 'Aplicacion',
      submenu: [
        { role: 'about', label: 'Acerca de Facturamas' },
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
          label: 'Abrir en navegador',
          click: () => shell.openExternal(FRONTEND_URL),
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
