# Facturamas Desktop

Wrapper Electron para ejecutar `facturamas` como app de escritorio sin Docker.

## Cómo funciona

- Construye un frontend específico en `desktop/frontend-dist`
- Lanza un MongoDB embebido local
- Arranca el backend Go en local en `http://127.0.0.1:3001`
- Sirve el frontend desktop en `http://127.0.0.1:5174`
- Abre una ventana de Electron sobre esa versión

## Requisitos

- macOS para generar `.app`
- Windows se puede empaquetar desde macOS con el script correspondiente
- Node.js 18+
- Go 1.22+

## Uso

```bash
cd desktop
npm install
npm run dev
```

## Generar `.app` local

```bash
cd desktop
npm install
npm run package:mac
```

La app se generará en:

```bash
desktop/out/Facturamas-darwin-arm64/Facturamas.app
```

Si `MAC_CODESIGN_IDENTITY` no esta definido, el paquete macOS se firma con una firma local ad-hoc. Esto sirve para desarrollo, pero Gatekeeper puede bloquearlo al distribuirlo por internet.

## Generar `.app` notarizada para distribucion publica

Para evitar avisos de Gatekeeper en usuarios finales, necesitas instalar en el llavero de macOS un certificado:

```text
Developer ID Application: Nombre del desarrollador (TEAMID)
```

Despues genera el paquete indicando la identidad exacta:

```bash
cd desktop
export MAC_CODESIGN_IDENTITY="Developer ID Application: Nombre del desarrollador (TEAMID)"
npm run package:mac
```

Para notarizar con Apple, usa una de estas opciones:

```bash
# Opcion A: perfil guardado previamente en Keychain con xcrun notarytool store-credentials
export APPLE_NOTARY_KEYCHAIN_PROFILE="facturamas-notary"

# Opcion B: Apple ID y contrasena especifica de app
export APPLE_ID="tu-apple-id"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"

# Opcion C: App Store Connect API key
export APPLE_API_KEY="/ruta/segura/AuthKey_KEYID.p8"
export APPLE_API_KEY_ID="KEYID"
export APPLE_API_ISSUER="issuer-uuid"
```

Y ejecuta:

```bash
npm run package:mac:notarized
```

No guardes nunca contrasenas, claves `.p8` ni secretos de notarizacion en el repositorio.

## Generar paquete Windows

```bash
cd desktop
npm install
npm run package:win
```

El comando genera un instalador NSIS en:

```text
desktop/out/Facturamas-Setup-VERSION-x64.exe
```

La instalacion es por usuario y mantiene los datos en `%APPDATA%\Facturamas`, por lo que instalar una version nueva no borra facturas, presupuestos, clientes, PDFs ni configuracion.

Si no hay certificado configurado, el paquete Windows se genera sin firma Authenticode. Windows puede mostrar avisos de SmartScreen o de seguridad indicando que no se puede comprobar el editor.

Para distribuir a terceros con menos avisos, necesitas un certificado de firma de codigo para Windows. Con un `.pfx`:

```bash
cd desktop
export WINDOWS_CERTIFICATE_FILE="/ruta/segura/certificado.pfx"
export WINDOWS_CERTIFICATE_PASSWORD="contrasena-del-certificado"
npm run package:win
```

Tambien puedes usar un proveedor HSM/KeyLocker o parametros personalizados de `signtool`:

```bash
export WINDOWS_SIGN_WITH_PARAMS='sign /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 ...'
npm run package:win
```

No guardes nunca certificados `.pfx`, contrasenas ni claves de firma en el repositorio.

## Datos persistentes y actualizaciones

Los datos de usuario no se guardan dentro de la carpeta de instalación ni dentro del `.app`/paquete Windows. La app usa el directorio estable de datos de Electron para `Facturamas`:

- macOS: `~/Library/Application Support/Facturamas`
- Windows: `%APPDATA%\Facturamas`

Dentro de esa carpeta se guardan:

- `mongo-data/`: base de datos local.
- `pdfs/`: PDFs generados.
- `logos/`: logos subidos en configuración.

Al instalar una versión nueva, el usuario puede reemplazar la aplicación sin borrar esos datos. Además, cuando Facturamas detecta un cambio de versión al arrancar, crea una copia previa en:

```text
upgrade-backups/
```

Se conservan automáticamente las 5 copias de actualización más recientes.

## Instalar o actualizar en `Applications`

```bash
cd desktop
npm run install-app
```

o, si prefieres el alias:

```bash
cd desktop
npm run update-app
```

## Nota

Esta estructura no afecta a la versión web actual.

- La versión web sigue funcionando como hasta ahora
- La versión desktop usa sus propios puertos y su propio almacenamiento local
- Los backups desde configuración incluyen perfiles, configuración, facturas, presupuestos, clientes y contactos
- La app permite resetear por separado facturas, clientes y contactos
- La carpeta `desktop/assets/` contiene los iconos usados al empaquetar la app
