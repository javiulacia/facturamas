import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const appPath = resolve(process.env.MAC_APP_PATH || 'out/Facturamas-darwin-arm64/Facturamas.app')
const backendPath = join(appPath, 'Contents', 'Resources', 'app.asar.unpacked', 'bin', 'facturamas-backend')
const identity = process.env.MAC_CODESIGN_IDENTITY

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  })

  if (result.status !== 0) {
    process.exit(result.status || 1)
  }
}

if (!existsSync(appPath)) {
  console.error(`No se encontro la app macOS en ${appPath}`)
  process.exit(1)
}

if (identity) {
  const embeddedBinaries = existsSync(backendPath) ? [backendPath] : []

  run('npx', [
    'electron-osx-sign',
    appPath,
    ...embeddedBinaries,
    `--identity=${identity}`,
    '--type=distribution',
    '--platform=darwin',
    '--hardened-runtime',
  ])
} else {
  console.warn('MAC_CODESIGN_IDENTITY no definido. Usando firma local ad-hoc para desarrollo.')
  run('codesign', ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath])
}

run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath])
