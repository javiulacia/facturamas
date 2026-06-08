import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { sign } from '@electron/windows-sign'

const appDirectory = resolve(process.env.WIN_APP_PATH || 'out/Facturamas-win32-x64')
const certificateFile = process.env.WINDOWS_CERTIFICATE_FILE
const certificatePassword = process.env.WINDOWS_CERTIFICATE_PASSWORD
const signWithParams = process.env.WINDOWS_SIGN_WITH_PARAMS

if (!existsSync(appDirectory)) {
  console.error(`No se encontro el paquete Windows en ${appDirectory}`)
  process.exit(1)
}

if (!certificateFile && !signWithParams) {
  console.warn(
    'WINDOWS_CERTIFICATE_FILE o WINDOWS_SIGN_WITH_PARAMS no definido. Saltando firma Authenticode de Windows.',
  )
  process.exit(0)
}

if (certificateFile && !certificatePassword) {
  console.error('WINDOWS_CERTIFICATE_PASSWORD es obligatorio cuando usas WINDOWS_CERTIFICATE_FILE.')
  process.exit(1)
}

await sign({
  appDirectory,
  certificateFile,
  certificatePassword,
  signWithParams,
  description: process.env.WINDOWS_SIGN_DESCRIPTION || 'Facturamas',
  website: process.env.WINDOWS_SIGN_WEBSITE || 'https://facturamas.es/',
})

console.log('Paquete Windows firmado correctamente.')
