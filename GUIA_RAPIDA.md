# Guia Rapida de Facturamas

Facturamas es una aplicacion local para gestionar facturas, presupuestos, clientes, contactos, backups y facturacion recurrente.

## Ejecutar con Docker

```bash
cd facturamas/app
docker compose up --build
```

Servicios:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`

## Ejecutar en desarrollo local

Backend:

```bash
cd facturamas/app/backend
cp .env.example .env
go mod download
go run cmd/main.go
```

Frontend:

```bash
cd facturamas/app/frontend
cp .env.example .env
npm install
npm run dev
```

## Aplicacion de escritorio

macOS:

```bash
cd facturamas/app/desktop
npm install
npm run package:mac
```

Windows, generado desde macOS:

```bash
cd facturamas/app/desktop
npm install
npm run package:win
```

Los paquetes se generan en `desktop/out/`.

## Funcionalidades principales

- Dashboard con resumen facturado, presupuestado, programado y proyeccion anual.
- Perfiles de facturacion independientes.
- Facturas con numeracion automatica, PDF y estados.
- Presupuestos con numeracion propia y conversion a factura.
- Facturas programadas recurrentes con generacion manual de pendientes.
- Clientes y contactos reutilizables.
- Backup manual JSON.

## Variables habituales

Backend:

```env
MONGODB_URI=mongodb://mongo:27017
DB_NAME=facturamas
SERVER_PORT=3000
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
PDF_OUTPUT_DIR=storage/pdfs
LOGO_STORAGE_DIR=storage/logos
```

Frontend:

```env
VITE_API_URL=http://localhost:3000/api
```

## Comandos utiles

Backend:

```bash
go test ./...
go build ./...
```

Frontend:

```bash
npm run build
npm run test
```

Auditoria npm:

```bash
npm audit --omit=dev
```

## API principal

- `GET /health`
- `GET /api/profiles`
- `PUT /api/profiles/:id`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/backup`
- `POST /api/settings/import-backup`
- `GET /api/clients`
- `POST /api/clients`
- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/invoices`
- `POST /api/invoices`
- `GET /api/budgets`
- `POST /api/budgets`
- `POST /api/budgets/:id/convert-to-invoice`
- `GET /api/invoice-schedules`
- `POST /api/invoice-schedules`
- `POST /api/invoice-schedules/:id/generate-due`
