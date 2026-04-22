#!/bin/bash
# VibraTickets Deployment Script
# Ejecutar después de configurar el VPS

set -e

# Configuración
APP_DIR="/var/www/vibra"
BACKEND_DIR="$APP_DIR/ApiTickets"
FRONTEND_DIR="$APP_DIR/VibraTicketsFrontend"
LOG_FILE="/var/log/vibra/deploy.log"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1" | tee -a $LOG_FILE
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1" | tee -a $LOG_FILE
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a $LOG_FILE
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1" | tee -a $LOG_FILE
}

check_error() {
    if [ $? -ne 0 ]; then
        log_error "$1"
        exit 1
    fi
}

echo "==========================================" | tee -a $LOG_FILE
echo "  VibraTickets - Deployment Script" | tee -a $LOG_FILE
echo "  $(date)" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE

# ==========================================
# VERIFICACIONES INICIALES
# ==========================================

if [ ! -d "$BACKEND_DIR" ] || [ ! -d "$FRONTEND_DIR" ]; then
    log_error "No se encontraron los directorios de la aplicación"
    log_info "Asegúrate de haber clonado el repositorio en $APP_DIR"
    exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
    log_warn "No se encontró $BACKEND_DIR/.env"
    log_info "Ejecuta: vibra-setup-env"
    exit 1
fi

# Cargar variables de entorno del backend
export $(grep -v '^#' "$BACKEND_DIR/.env" | xargs) 2>/dev/null || true

# ==========================================
# VERIFICAR CONEXIÓN A BASE DE DATOS
# ==========================================
log_step "Verificando conexión a MariaDB..."

# Esperar a que MariaDB esté disponible
MAX_RETRIES=30
RETRY_COUNT=0

while ! mysqladmin ping -h "${DB_HOST:-localhost}" --silent 2>/dev/null; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        log_error "No se pudo conectar a MariaDB después de $MAX_RETRIES intentos"
        exit 1
    fi
    log_warn "Esperando a MariaDB... (intento $RETRY_COUNT/$MAX_RETRIES)"
    sleep 2
done

log_info "✅ MariaDB está disponible"

# Verificar que la base de datos existe
DB_EXISTS=$(mysql -h "${DB_HOST:-localhost}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='${DB_NAME}';" 2>/dev/null || true)

if [ -z "$DB_EXISTS" ]; then
    log_warn "La base de datos '${DB_NAME}' no existe. Creándola..."
    mysql -h "${DB_HOST:-localhost}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || {
        log_error "No se pudo crear la base de datos. Verifica los permisos del usuario."
        exit 1
    }
    log_info "✅ Base de datos '${DB_NAME}' creada"
else
    log_info "✅ Base de datos '${DB_NAME}' existe"
fi

# ==========================================
# BACKEND DEPLOYMENT
# ==========================================
log_step "Desplegando Backend..."

cd $BACKEND_DIR

# Instalar dependencias
log_info "Instalando dependencias del backend..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile --production
elif [ -f "package-lock.json" ]; then
    npm ci --production
else
    npm install --production
fi
check_error "Error al instalar dependencias del backend"

# ==========================================
# EJECUTAR MIGRACIONES
# ==========================================
log_step "Ejecutando migraciones de base de datos..."

# Verificar si hay scripts de migración
if [ -d "migrations" ] && [ "$(ls -A migrations)" ]; then
    log_info "Encontradas migraciones en /migrations"

    # Ejecutar migraciones pendientes
    if npm run db:migrate:pending 2>/dev/null; then
        log_info "Ejecutando migraciones..."
        npm run db:migrate:all || npm run db:migrate || {
            log_warn "No se pudieron ejecutar todas las migraciones automáticamente"
        }
    else
        log_info "No hay migraciones pendientes o script no disponible"
    fi
elif [ -f "scripts/run-migrations.js" ]; then
    log_info "Ejecutando migraciones desde scripts/run-migrations.js..."
    node scripts/run-migrations.js 2>/dev/null || {
        log_warn "No se pudieron ejecutar migraciones"
    }
else
    log_info "No se encontraron scripts de migración. Saltando..."
fi

# Verificar que las tablas existen
log_info "Verificando tablas en la base de datos..."
TABLES=$(mysql -h "${DB_HOST:-localhost}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SHOW TABLES;" ${DB_NAME} 2>/dev/null | wc -l || echo "0")
if [ "$TABLES" -gt 0 ]; then
    log_info "✅ Base de datos contiene tablas ($TABLES filas en SHOW TABLES)"
else
    log_warn "⚠️ La base de datos parece estar vacía. Si es primera vez, esto es normal."
fi

# ==========================================
# INICIAR/REINICIAR PM2
# ==========================================
log_step "Configurando PM2..."

if pm2 list | grep -q "ticketera-api"; then
    log_info "Reiniciando servicio existente..."
    pm2 reload ecosystem.config.js --env production
else
    log_info "Iniciando nuevo servicio..."
    pm2 start ecosystem.config.js --env production
fi
check_error "Error al iniciar/reiniciar PM2"

# Guardar configuración de PM2
pm2 save

# ==========================================
# FRONTEND DEPLOYMENT
# ==========================================
log_step "Desplegando Frontend..."

cd $FRONTEND_DIR

# Instalar dependencias
log_info "Instalando dependencias del frontend..."
if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile
elif [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi
check_error "Error al instalar dependencias del frontend"

# Actualizar URL del API en el .env del frontend si es necesario
if [ -f ".env" ]; then
    CURRENT_API_URL=$(grep VITE_API_URL .env | cut -d '=' -f2 || echo "")
    if [ -z "$CURRENT_API_URL" ] || [ "$CURRENT_API_URL" = "http://localhost:3000/api" ]; then
        # Obtener IP pública o usar localhost
        PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
        log_warn "Actualizando VITE_API_URL a http://${PUBLIC_IP}/api"
        sed -i "s|VITE_API_URL=.*|VITE_API_URL=http://${PUBLIC_IP}/api|" .env
    fi
fi

# Construir el frontend
log_info "Construyendo frontend..."
npm run build
check_error "Error al construir el frontend"

# Verificar que se generó el dist
if [ ! -d "$FRONTEND_DIR/dist" ]; then
    log_error "No se encontró el directorio dist después del build"
    exit 1
fi

log_info "✅ Frontend construido exitosamente"

# ==========================================
# NGINX RELOAD
# ==========================================
log_step "Recargando Nginx..."

sudo nginx -t
check_error "La configuración de Nginx tiene errores"

sudo systemctl reload nginx
check_error "Error al recargar Nginx"

# ==========================================
# VERIFICACIÓN FINAL
# ==========================================
log_step "Verificando despliegue..."

# Esperar a que el backend responda
sleep 3

HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    log_info "✅ Backend respondiendo correctamente (HTTP $HEALTH_STATUS)"
else
    log_warn "⚠️ Backend no responde (HTTP $HEALTH_STATUS)"
    log_info "Revisa los logs con: pm2 logs"
fi

NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80/ 2>/dev/null || echo "000")

if [ "$NGINX_STATUS" = "200" ] || [ "$NGINX_STATUS" = "304" ]; then
    log_info "✅ Nginx respondiendo correctamente (HTTP $NGINX_STATUS)"
else
    log_warn "⚠️ Nginx no responde como esperado (HTTP $NGINX_STATUS)"
fi

# Verificar conexión a base de datos desde el backend
log_info "Verificando conexión a base de datos desde el backend..."
DB_TEST=$(curl -s http://localhost:3000/health 2>/dev/null | grep -o '"database":"[^"]*"' | cut -d'"' -f4 || echo "unknown")
if [ "$DB_TEST" = "connected" ] || [ "$DB_TEST" = "ok" ]; then
    log_info "✅ Base de datos conectada correctamente"
else
    log_warn "⚠️ Estado de base de datos: $DB_TEST"
fi

echo "" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE
echo "  Despliegue completado exitosamente!" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "Estado de servicios:" | tee -a $LOG_FILE
pm2 list 2>/dev/null | tee -a $LOG_FILE || true
echo "" | tee -a $LOG_FILE
echo "Comandos útiles:" | tee -a $LOG_FILE
echo "  vibra-health         - Verificar estado de todos los servicios" | tee -a $LOG_FILE
echo "  pm2 status           - Ver estado del backend" | tee -a $LOG_FILE
echo "  pm2 logs             - Ver logs en tiempo real" | tee -a $LOG_FILE
echo "  pm2 restart ticketera-api - Reiniciar backend" | tee -a $LOG_FILE
echo "  sudo nginx -t        - Verificar config Nginx" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "Para conectar un dominio:" | tee -a $LOG_FILE
echo "  1. Apunta tu dominio a la IP del VPS" | tee -a $LOG_FILE
echo "  2. Edita /etc/nginx/sites-available/vibra" | tee -a $LOG_FILE
echo "  3. Cambia 'server_name _' por 'server_name tu-dominio.com'" | tee -a $LOG_FILE
echo "  4. Ejecuta: sudo certbot --nginx -d tu-dominio.com" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
echo "Acceso a la aplicación:" | tee -a $LOG_FILE
echo "  Frontend: http://$(curl -s ifconfig.me 2>/dev/null || echo 'TU_IP')" | tee -a $LOG_FILE
echo "  API:      http://$(curl -s ifconfig.me 2>/dev/null || echo 'TU_IP')/api" | tee -a $LOG_FILE
echo "" | tee -a $LOG_FILE
