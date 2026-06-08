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

## Generar paquete Windows

```bash
cd desktop
npm install
npm run package:win
```

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
