#!/bin/bash

# Facturamas - Quick Start Script

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║                    Iniciando Facturamas                       ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Función para imprimir mensajes
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Verificar Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker no está instalado"
    exit 1
fi
print_status "Docker encontrado"

# Verificar Docker Compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    print_error "Docker Compose no está instalado"
    exit 1
fi
print_status "Docker Compose encontrado"

# Obtener directorio del script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Verificar archivos críticos
if [ ! -f "docker-compose.yml" ]; then
    print_error "No se encontró docker-compose.yml"
    exit 1
fi
print_status "Archivos de configuración verificados"

# Limpiar contenedores antiguos (opcional)
print_info "Limpiando contenedores antiguos..."
docker compose down 2>/dev/null

# Construir e iniciar
echo ""
echo "Iniciando servicios..."
echo ""

docker compose up --build
EXIT_CODE=$?

# Verificar si docker compose fue exitoso
if [ $EXIT_CODE -ne 0 ]; then
    echo ""
    print_error "Error al iniciar los servicios"
    echo ""
    print_info "Posibles causas:"
    echo "  • Docker daemon no está corriendo"
    echo "  • Puertos en uso (5173, 3000, 27017)"
    echo "  • Memoria o recursos insuficientes"
    echo ""
    print_info "Soluciones:"
    echo "  1. Asegúrate de que Docker Desktop está corriendo"
    echo "  2. Libera los puertos necesarios"
    echo "  3. Revisa los logs con: docker compose logs"
    echo ""
    exit $EXIT_CODE
fi

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                                                                ║"
echo "║                     ✅ Sistema Iniciado                        ║"
echo "║                                                                ║"
echo "║            Frontend: http://localhost:5173                    ║"
echo "║            API:      http://localhost:3000/api                ║"
echo "║            MongoDB:  localhost:27017                          ║"
echo "║                                                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
