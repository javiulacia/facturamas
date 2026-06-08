import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { notarize } from '@electron/notarize'

const appPath = resolve(process.env.MAC_APP_PATH || 'out/Facturamas-darwin-arm64/Facturamas.app')

function getCredentials() {
  if (process.env.APPLE_NOTARY_KEYCHAIN_PROFILE) {
    return {
      keychainProfile: process.env.APPLE_NOTARY_KEYCHAIN_PROFILE,
      ...(process.env.APPLE_NOTARY_KEYCHAIN
        ? { keychain: process.env.APPLE_NOTARY_KEYCHAIN }
        : {}),
    }
  }

  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID) {
    return {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      ...(process.env.APPLE_API_ISSUER
        ? { appleApiIssuer: process.env.APPLE_API_ISSUER }
        : {}),
    }
  }

  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) {
    return {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    }
  }

  throw new Error(
    'Faltan credenciales de notarizacion. Define APPLE_NOTARY_KEYCHAIN_PROFILE, o APPLE_API_KEY/APPLE_API_KEY_ID, o APPLE_ID/APPLE_APP_SPECIFIC_PASSWORD/APPLE_TEAM_ID.',
  )
}

if (!existsSync(appPath)) {
  console.error(`No se encontro la app macOS en ${appPath}`)
  process.exit(1)
}

await notarize({
  appPath,
  ...getCredentials(),
})

console.log('Facturamas.app notarizada y con ticket stapled correctamente.')
