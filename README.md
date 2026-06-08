# Facturamas

**Facturamas** es una aplicación de escritorio para gestionar facturas, presupuestos, clientes, contactos y facturación recurrente desde un entorno local, sencillo y privado.

Está pensada para autónomos, freelancers y pequeñas empresas que necesitan emitir facturas, preparar presupuestos y tener una visión clara de su actividad sin depender de un SaaS externo para almacenar sus datos.

- Web del proyecto: [facturamas.es](http://facturamas.es/)
- Desarrollado por: **DEEPCOM NET, S.L.U.**
- Web corporativa: [deepcom.net](https://deepcom.net)
- Contacto: [javi@deepcom.net](mailto:javi@deepcom.net)

## Funcionalidades

### Dashboard

- Vista inicial con resumen del perfil activo.
- Total facturado.
- Total presupuestado.
- Total programado.
- Previsión de facturación por meses.
- Proyección de facturación anual.

### Perfiles de facturación

- Soporte para múltiples perfiles de facturación.
- Configuración independiente de datos fiscales, serie, moneda, IVA e IRPF.
- Cambio rápido de perfil activo desde la interfaz.
- Numeración independiente por perfil.

### Facturas

- Creación, edición, consulta, duplicado y eliminación de facturas.
- Numeración automática y segura desde backend.
- Series configurables por perfil.
- Estados de factura: borrador, emitida y pagada.
- Gestión de líneas con cantidades, precios, IVA e IRPF.
- Cálculo automático de subtotal, impuestos, retenciones y total.
- Snapshot de los datos del emisor en el momento de emisión.
- Generación y descarga de PDF.
- Vista previa de PDF dentro de la aplicación.

### Presupuestos

- Sección independiente de presupuestos.
- Secuencia de numeración propia, separada de las facturas.
- Creación, edición, consulta, duplicado y eliminación.
- Conversión directa de presupuesto a factura.
- Al convertir un presupuesto, la factura se genera con la fecha actual de la acción.

### Facturas programadas

- Programación de facturas recurrentes.
- Frecuencia semanal o mensual.
- Intervalos configurables.
- Fecha de primera emisión, próxima emisión, vencimiento y fecha final opcional.
- Estado inicial configurable.
- Creación manual de facturas pendientes si la aplicación estaba cerrada.

### Clientes y contactos

- Gestión de clientes reutilizables.
- Búsqueda de clientes por nombre, NIF/CIF o dirección.
- Selección de cliente guardado al crear facturas o presupuestos.
- Gestión de contactos comerciales.

### Calendario fiscal

- Sección de calendario fiscal.
- Vista orientativa de obligaciones y fechas relevantes para el perfil activo.

### Backups

- Exportación manual de backup JSON.
- Importación de backup JSON.
- El backup incluye perfiles, configuración, clientes, contactos, facturas y presupuestos.

## Privacidad y almacenamiento

Facturamas está diseñado como una aplicación local. En la versión de escritorio, los datos se guardan en el equipo del usuario mediante una base de datos MongoDB embebida gestionada por la propia app.

La aplicación no necesita enviar facturas ni clientes a servidores externos para funcionar. Los backups pueden exportarse e importarse manualmente desde la sección de configuración.

En las versiones empaquetadas para escritorio, los datos no se guardan dentro de la aplicación instalada. Se guardan en el directorio estable de datos del usuario:

- macOS: `~/Library/Application Support/Facturamas`
- Windows: `%APPDATA%\Facturamas`

Esto permite reemplazar la app por una versión nueva sin perder facturas, presupuestos, clientes, PDFs ni configuración. Además, al detectar un cambio de versión, Facturamas crea automáticamente una copia previa de `mongo-data/`, `pdfs/` y `logos/` dentro de `upgrade-backups/`, conservando las 5 copias de actualización más recientes.

## Stack técnico

### Frontend

- React 18
- TypeScript
- Vite
- React Router
- React Hook Form
- Zod
- Tailwind CSS
- Axios

### Backend

- Go 1.22
- Gin
- MongoDB Driver
- Generación de PDFs con gofpdf
- Arquitectura por capas: domain, handlers, services y repositories

### Escritorio

- Electron
- MongoDB embebido mediante `mongodb-memory-server-core`
- Backend Go empaquetado como binario local
- Frontend servido localmente dentro de la app

## Requisitos de desarrollo

Para ejecutar el proyecto en local:

- Go 1.22+
- Node.js 18+
- npm
- Docker y Docker Compose, opcional para entorno web local
- MongoDB, si se ejecuta el backend fuera del contenedor o fuera de la app Electron

## Inicio rápido con Docker

Desde la raíz del proyecto:

```bash
docker compose up --build
```

Servicios por defecto:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`
- MongoDB: `localhost:27017`

## Desarrollo local sin Docker

### Backend

```bash
cd backend
cp .env.example .env
go mod download
go run cmd/main.go
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Aplicación de escritorio

La carpeta `desktop/` contiene el wrapper Electron que ejecuta Facturamas como aplicación de escritorio para macOS y Windows.

### Ejecutar en desarrollo

```bash
cd desktop
npm install
npm run dev
```

### Generar paquete `.app`

```bash
cd desktop
npm run package:mac
```

Para distribucion publica en macOS sin avisos de Gatekeeper, instala un certificado `Developer ID Application`, configura `MAC_CODESIGN_IDENTITY` y ejecuta:

```bash
cd desktop
npm run package:mac:notarized
```

Consulta [`desktop/README.md`](desktop/README.md) para las variables de notarizacion de Apple.

### Generar paquete Windows

```bash
cd desktop
npm run package:win
```

### Instalar en `/Applications`

```bash
cd desktop
npm run install-app
```

## Variables de entorno principales

Backend:

```env
MONGODB_URI=mongodb://mongo:27017
DB_NAME=facturamas
SERVER_PORT=3000
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PDF_OUTPUT_DIR=storage/pdfs
LOGO_STORAGE_DIR=storage/logos
```

En la app de escritorio, estas rutas se configuran automáticamente dentro del directorio de datos de usuario.

## Estructura del proyecto

```text
facturamas/
├── backend/                 # API en Go + Gin
│   ├── cmd/                 # Entry point del backend
│   └── internal/
│       ├── config/          # Configuración y MongoDB
│       ├── domain/          # Modelos y contratos
│       ├── handlers/        # HTTP handlers
│       ├── middleware/      # Middlewares
│       ├── repositories/    # Acceso a datos
│       └── services/        # Lógica de negocio
├── frontend/                # Aplicación React + Vite
│   └── src/
│       ├── pages/           # Pantallas principales
│       ├── services/        # Cliente API
│       ├── types/           # Tipos TypeScript
│       └── utils/           # Utilidades
├── desktop/                 # Wrapper Electron para escritorio
├── docker-compose.yml       # Entorno local con Docker
└── README.md
```

## API REST principal

### Perfiles y configuración

```text
GET    /api/profiles
GET    /api/profiles/:id
PUT    /api/profiles/:id
GET    /api/settings
PUT    /api/settings
GET    /api/settings/backup
POST   /api/settings/import-backup
POST   /api/settings/sync-profiles
POST   /api/settings/reset-invoices
POST   /api/settings/reset-clients
POST   /api/settings/reset-contacts
```

### Clientes y contactos

```text
GET    /api/clients
POST   /api/clients
GET    /api/clients/:id
PUT    /api/clients/:id
DELETE /api/clients/:id

GET    /api/contacts
POST   /api/contacts
GET    /api/contacts/:id
PUT    /api/contacts/:id
DELETE /api/contacts/:id
```

### Facturas

```text
GET    /api/invoices
POST   /api/invoices
GET    /api/invoices/:id
PUT    /api/invoices/:id
DELETE /api/invoices/:id
POST   /api/invoices/:id/duplicate
GET    /api/invoices/:id/pdf
GET    /api/invoices/:id/pdf/download
```

### Presupuestos

```text
GET    /api/budgets
POST   /api/budgets
GET    /api/budgets/:id
PUT    /api/budgets/:id
DELETE /api/budgets/:id
POST   /api/budgets/:id/duplicate
POST   /api/budgets/:id/convert-to-invoice
```

### Programaciones

```text
GET    /api/invoice-schedules
POST   /api/invoice-schedules
GET    /api/invoice-schedules/:id
PUT    /api/invoice-schedules/:id
DELETE /api/invoice-schedules/:id
POST   /api/invoice-schedules/:id/generate-due
```

### Salud

```text
GET    /health
```

## Calidad y validaciones

- El backend recalcula los importes y no confía en totales enviados desde frontend.
- La numeración se genera en backend para reducir riesgos de duplicidad.
- Las operaciones se aíslan por perfil activo.
- Los backups remapean identificadores de perfiles al importar para evitar conflictos.

## Estado del proyecto

Facturamas está en desarrollo activo. La versión principal está orientada a escritorio local, con empaquetado para macOS y Windows.

## Licencia

Facturamas se distribuye bajo licencia MIT. Consulta el archivo [`../LICENSE`](../LICENSE).
