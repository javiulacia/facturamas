# Facturamas API - Backend

Backend Go de Facturamas para gestionar facturas, presupuestos, clientes, contactos, backups y perfiles de facturación.

## Structure

```
cmd/
  └── main.go              # Application entry point
internal/
  ├── config/              # Configuration and MongoDB setup
  ├── domain/              # Domain models and interfaces
  ├── handlers/            # HTTP request handlers
  ├── middleware/          # Middleware (CORS, etc)
  ├── repositories/        # MongoDB data access layer
  └── services/            # Business logic layer
```

## API Endpoints

### Settings
- `GET /api/settings` - Get current settings
- `PUT /api/settings` - Update settings

### Invoices
- `GET /api/invoices` - List all invoices
- `POST /api/invoices` - Create new invoice
- `GET /api/invoices/:id` - Get invoice by ID
- `PUT /api/invoices/:id` - Update invoice
- `DELETE /api/invoices/:id` - Delete invoice
- `POST /api/invoices/:id/duplicate` - Duplicate invoice

### Health
- `GET /health` - Health check

## Running Locally

### Prerequisites
- Go 1.22+
- MongoDB running

### Setup

1. Install dependencies:
```bash
go mod download
```

2. Create .env file:
```bash
cp .env.example .env
```

3. Update .env with your MongoDB URI

4. Run:
```bash
go run cmd/main.go
```

API will be available at `http://localhost:3000`

## Docker

Build image:
```bash
docker build -t facturamas-api .
```

Run container:
```bash
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://mongo:27017 \
  -e DB_NAME=facturamas \
  facturamas-api
```

## Invoice Number Generation

Invoice numbers are generated atomically using MongoDB's findOneAndUpdate operation with the sequence counter in settings. Format: `{SERIES}-{SEQUENCE}` (e.g., `2026-00001`)

## Data Validation

All calculations (subtotals, VAT, withholding, totals) are performed server-side to ensure accuracy and prevent tampering. Frontend calculations should be for UX only.
