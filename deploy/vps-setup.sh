#!/bin/bash
# VPS Setup Script for VibraTickets
# Ejecutar en el VPS como root o con sudo

set -e

echo "=========================================="
echo "  VibraTickets - VPS Setup Script"
echo "=========================================="
echo ""

# Configuración
NODE_VERSION="20"
APP_USER="vibra"
APP_DIR="/var/www/vibra"
BACKEND_DIR="$APP_DIR/ApiTickets"
FRONTEND_DIR="$APP_DIR/VibraTicketsFrontend"

# Credenciales de Base de Datos (cambiar en producción)
DB_NAME="ticketera"
DB_USER="vibra_user"
DB_PASSWORD="$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)"
DB_ROOT_PASSWORD="$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Actualizar sistema
log_step "Actualizando sistema..."
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -o Dpkg::Options::="--force-confold"

# Instalar dependencias básicas
log_step "Instalando dependencias básicas..."
apt-get install -y curl wget git vim nginx ufw software-properties-common gnupg2 ca-certificates lsb-release apt-transport-https net-tools

# ==========================================
# MARIADB INSTALLATION
# ==========================================
log_step "Instalando MariaDB..."

# Verificar si MariaDB ya está instalado
if command -v mariadb &> /dev/null || command -v mysql &> /dev/null; then
    log_warn "MariaDB/MySQL ya está instalado. Saltando instalación..."
else
    # Instalar MariaDB desde repositorios oficiales
    curl -LsS https://downloads.mariadb.com/MariaDB/mariadb_repo_setup | bash -s -- --mariadb-server-version=10.11
    apt-get update -y
    DEBIAN_FRONTEND=noninteractive apt-get install -y mariadb-server mariadb-client

    # Iniciar y habilitar MariaDB
    systemctl start mariadb
    systemctl enable mariadb

    # Seguridad básica de MariaDB
    log_info "Configurando seguridad de MariaDB..."

    # Establecer contraseña de root
    mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '${DB_ROOT_PASSWORD}';" || true

    # Eliminar usuarios anónimos
    mysql -e "DELETE FROM mysql.user WHERE User='';" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || true

    # Eliminar acceso remoto de root
    mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || true

    # Eliminar base de datos de test
    mysql -e "DROP DATABASE IF EXISTS test;" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || true
    mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || true

    # Recargar privilegios
    mysql -e "FLUSH PRIVILEGES;" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || true

    log_info "MariaDB instalado y configurado correctamente"
fi

# Crear base de datos y usuario de la aplicación
log_step "Creando base de datos y usuario..."

# Verificar si la base de datos ya existe
DB_EXISTS=$(mysql -e "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME='${DB_NAME}';" 2>/dev/null || true)

if [ -n "$DB_EXISTS" ]; then
    log_warn "La base de datos '${DB_NAME}' ya existe. Saltando creación..."
else
    # Crear base de datos
    mysql -e "CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || mysql -e "CREATE DATABASE ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    log_info "Base de datos '${DB_NAME}' creada"
fi

# Verificar si el usuario ya existe
USER_EXISTS=$(mysql -e "SELECT user FROM mysql.user WHERE user='${DB_USER}';" 2>/dev/null || true)

if [ -n "$USER_EXISTS" ]; then
    log_warn "El usuario '${DB_USER}' ya existe. Actualizando contraseña..."
    mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
else
    # Crear usuario
    mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || mysql -e "CREATE USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASSWORD}';"
    log_info "Usuario '${DB_USER}' creado"
fi

# Otorgar privilegios
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;" -p"${DB_ROOT_PASSWORD}" 2>/dev/null || mysql -e "FLUSH PRIVILEGES;"

log_info "Privilegios otorgados a '${DB_USER}' en la base de datos '${DB_NAME}'"

# Guardar credenciales en archivo seguro
log_info "Guardando credenciales de base de datos..."
mkdir -p /root/.vibra
cat > /root/.vibra/db-credentials.txt << EOF
=== VIBRATICKETS DATABASE CREDENTIALS ===
Generated: $(date)
========================================

Root Password: ${DB_ROOT_PASSWORD}
Database Name: ${DB_NAME}
Database User: ${DB_USER}
Database Password: ${DB_PASSWORD}

Connection String:
mysql -u ${DB_USER} -p${DB_PASSWORD} ${DB_NAME}

========================================
EOF
chmod 600 /root/.vibra/db-credentials.txt

# ==========================================
# NODE.JS & PM2
# ==========================================
log_step "Instalando Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

node_version=$(node --version)
npm_version=$(npm --version)
log_info "Node.js version: $node_version"
log_info "npm version: $npm_version"

log_info "Instalando PM2 y pnpm..."
npm install -g pm2 pnpm

# ==========================================
# REDIS
# ==========================================
log_step "Instalando Redis..."
apt-get install -y redis-server

# Configurar Redis con autenticación
REDIS_PASSWORD="$(openssl rand -base64 32 | tr -dc 'a-zA-Z0-9' | head -c 24)"
sed -i 's/^# requirepass foobared/requirepass '${REDIS_PASSWORD}'/' /etc/redis/redis.conf || echo "requirepass ${REDIS_PASSWORD}" >> /etc/redis/redis.conf
sed -i 's/^bind 127.0.0.1 ::1/bind 127.0.0.1/' /etc/redis/redis.conf || true
sed -i 's/^# bind 127.0.0.1/bind 127.0.0.1/' /etc/redis/redis.conf || true

systemctl restart redis-server
systemctl enable redis-server

# Guardar credenciales de Redis
echo "" >> /root/.vibra/db-credentials.txt
echo "Redis Password: ${REDIS_PASSWORD}" >> /root/.vibra/db-credentials.txt

# ==========================================
# USUARIO Y DIRECTORIOS
# ==========================================
log_step "Creando usuario de aplicación..."
if ! id "$APP_USER" &>/dev/null; then
    useradd -m -s /bin/bash $APP_USER
    log_info "Usuario $APP_USER creado"
else
    log_warn "Usuario $APP_USER ya existe"
fi

log_info "Creando directorios de aplicación..."
mkdir -p $APP_DIR
mkdir -p /var/log/vibra
mkdir -p /var/www/vibra/uploads
mkdir -p /var/backups/vibra
chown -R $APP_USER:$APP_USER $APP_DIR
chown -R $APP_USER:$APP_USER /var/log/vibra
chown -R $APP_USER:$APP_USER /var/www/vibra/uploads
chmod 755 /var/backups/vibra

# ==========================================
# FIREWALL
# ==========================================
log_step "Configurando firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
log_info "Firewall configurado"

# ==========================================
# NGINX
# ==========================================
log_step "Configurando Nginx..."

# Crear configuración de Nginx
cat > /etc/nginx/sites-available/vibra << 'EOF'
# Backend API - Proxy inverso
server {
    listen 80;
    server_name _;  # Cambiar por tu dominio

    # Logs
    access_log /var/log/nginx/vibra-access.log;
    error_log /var/log/nginx/vibra-error.log;

    # Tamaño máximo de upload
    client_max_body_size 50M;

    # Frontend - Archivos estáticos
    location / {
        root /var/www/vibra/VibraTicketsFrontend/dist;
        try_files $uri $uri/ /index.html;
        index index.html;

        # Cache para assets estáticos
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API - Proxy al backend
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Webhooks - MercadoPago
    location /webhooks {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:3000/health;
        access_log off;
    }
}
EOF

ln -sf /etc/nginx/sites-available/vibra /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl restart nginx
systemctl enable nginx
log_info "Nginx configurado"

# ==========================================
# PM2 STARTUP
# ==========================================
log_step "Configurando PM2 startup..."
env PATH=$PATH:/usr/bin pm2 startup systemd -u $APP_USER --hp /home/$APP_USER

# ==========================================
# SCRIPT DE CONFIGURACIÓN DE ENTORNO
# ==========================================
log_step "Creando script de configuración de entorno..."

cat > /usr/local/bin/vibra-setup-env << EOF
#!/bin/bash
# Configura automáticamente el archivo .env del backend

BACKEND_DIR="${BACKEND_DIR}"
FRONTEND_DIR="${FRONTEND_DIR}"

if [ ! -d "\$BACKEND_DIR" ]; then
    echo "Error: No se encontró el directorio del backend en \$BACKEND_DIR"
    echo "Asegúrate de haber clonado el repositorio primero."
    exit 1
fi

# Generar JWT secrets
JWT_SECRET=\$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)
SESSION_SECRET=\$(openssl rand -base64 64 | tr -dc 'a-zA-Z0-9' | head -c 64)

# Crear archivo .env del backend
cat > \$BACKEND_DIR/.env << ENVFILE
# ==========================================
# VibraTickets - Production Environment
# ==========================================

# Server Configuration
PORT=3000
NODE_ENV=production
BASE_URL=http://\$(curl -s ifconfig.me || echo 'localhost')

# Database Configuration (MariaDB)
DB_HOST=localhost
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# CORS Configuration
ALLOWED_ORIGINS=*

# JWT Configuration
JWT_SECRET=\${JWT_SECRET}
SESSION_SECRET=\${SESSION_SECRET}

# MercadoPago Configuration (REEMPLAZAR)
MP_ACCESS_TOKEN=TEST-your-access-token-here
MP_PUBLIC_KEY=TEST-your-public-key-here
MP_WEBHOOK_SECRET=your_webhook_secret_here

# Queue Configuration
QUEUE_MAX_SIZE=1000
QUEUE_TIMEOUT_MINUTES=15
HOLD_MINUTES=7

# Health Check
HEALTH_ALLOW_DEGRADED=true

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_PATH=./uploads

# Email Configuration (REEMPLAZAR)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
SES_FROM_EMAIL=noreply@example.com
SES_FROM_NAME=VibraTickets
ENVFILE

chown ${APP_USER}:${APP_USER} \$BACKEND_DIR/.env
chmod 600 \$BACKEND_DIR/.env

echo "✅ Archivo .env del backend creado en \$BACKEND_DIR/.env"
echo ""
echo "⚠️ IMPORTANTE: Edita el archivo y configura:"
echo "   - MP_ACCESS_TOKEN (MercadoPago)"
echo "   - MP_PUBLIC_KEY (MercadoPago)"
echo "   - AWS_ACCESS_KEY_ID (Email)"
echo "   - AWS_SECRET_ACCESS_KEY (Email)"
echo "   - BASE_URL (tu dominio)"
echo "   - ALLOWED_ORIGINS (tu dominio)"
echo ""
echo "Para editar: nano \$BACKEND_DIR/.env"

# Crear .env del frontend si existe el directorio
if [ -d "\$FRONTEND_DIR" ]; then
    cat > \$FRONTEND_DIR/.env << FRONTENDENV
VITE_API_URL=http://\$(curl -s ifconfig.me || echo 'localhost')/api
VITE_APP_NAME=VibraTickets
FRONTENDENV
    chown ${APP_USER}:${APP_USER} \$FRONTEND_DIR/.env
    echo "✅ Archivo .env del frontend creado"
fi
EOF

chmod +x /usr/local/bin/vibra-setup-env

# ==========================================
# SCRIPT DE DESPLIEGUE
# ==========================================
log_step "Creando script de despliegue..."

cat > /usr/local/bin/vibra-deploy << 'EOF'
#!/bin/bash
# Script de despliegue rápido

set -e

APP_DIR="/var/www/vibra"
BACKEND_DIR="$APP_DIR/ApiTickets"
FRONTEND_DIR="$APP_DIR/VibraTicketsFrontend"
LOG_FILE="/var/log/vibra/deploy.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "==========================================" | tee -a $LOG_FILE
echo "  VibraTickets - Deployment" | tee -a $LOG_FILE
echo "  $(date)" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE

# Verificar directorios
if [ ! -d "$BACKEND_DIR" ]; then
    echo -e "${RED}Error: No se encontró $BACKEND_DIR${NC}"
    echo "Clona el repositorio primero:"
    echo "  git clone <tu-repo> $APP_DIR"
    exit 1
fi

# Verificar .env
if [ ! -f "$BACKEND_DIR/.env" ]; then
    echo -e "${YELLOW}Archivo .env no encontrado. Ejecutando vibra-setup-env...${NC}"
    vibra-setup-env
    echo -e "${RED}Por favor edita el archivo .env y vuelve a ejecutar este script${NC}"
    exit 1
fi

# Desplegar backend
echo -e "${GREEN}[INFO]${NC} Desplegando backend..." | tee -a $LOG_FILE
cd $BACKEND_DIR

if [ -f "package-lock.json" ]; then
    npm ci --production
elif [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile --production
else
    npm install --production
fi

# Ejecutar migraciones si existen
if [ -d "migrations" ] || [ -f "scripts/run-migrations.js" ]; then
    echo -e "${GREEN}[INFO]${NC} Ejecutando migraciones..." | tee -a $LOG_FILE
    npm run db:migrate:all 2>/dev/null || npm run db:migrate 2>/dev/null || echo "No se encontraron migraciones"
fi

# Reiniciar/Iniciar con PM2
if pm2 list | grep -q "ticketera-api"; then
    echo -e "${GREEN}[INFO]${NC} Reiniciando servicio existente..." | tee -a $LOG_FILE
    pm2 reload ecosystem.config.js --env production
else
    echo -e "${GREEN}[INFO]${NC} Iniciando servicio..." | tee -a $LOG_FILE
    pm2 start ecosystem.config.js --env production
fi

pm2 save

# Desplegar frontend
echo -e "${GREEN}[INFO]${NC} Desplegando frontend..." | tee -a $LOG_FILE
cd $FRONTEND_DIR

if [ -f "pnpm-lock.yaml" ]; then
    pnpm install --frozen-lockfile
elif [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

npm run build

# Recargar nginx
echo -e "${GREEN}[INFO]${NC} Recargando Nginx..." | tee -a $LOG_FILE
sudo nginx -t && sudo systemctl reload nginx

# Verificar salud
sleep 3
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")

if [ "$HEALTH_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ Backend respondiendo correctamente${NC}" | tee -a $LOG_FILE
else
    echo -e "${YELLOW}⚠️ Backend no responde (HTTP $HEALTH_STATUS)${NC}" | tee -a $LOG_FILE
fi

echo "" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE
echo "  Despliegue completado!" | tee -a $LOG_FILE
echo "==========================================" | tee -a $LOG_FILE
pm2 list | tee -a $LOG_FILE
EOF

chmod +x /usr/local/bin/vibra-deploy

# ==========================================
# SCRIPT DE BACKUP
# ==========================================
log_step "Creando script de backup..."

cat > /usr/local/bin/vibra-backup << EOF
#!/bin/bash
# Backup de base de datos

BACKUP_DIR="/var/backups/vibra"
DATE=\$(date +%Y%m%d_%H%M%S)
DB_NAME="${DB_NAME}"
mkdir -p \$BACKUP_DIR

# Backup MariaDB
mysqldump -u root -p"${DB_ROOT_PASSWORD}" \$DB_NAME > "\$BACKUP_DIR/\${DB_NAME}_\${DATE}.sql" 2>/dev/null || \
mysqldump \$DB_NAME > "\$BACKUP_DIR/\${DB_NAME}_\${DATE}.sql"

# Comprimir backup
gzip "\$BACKUP_DIR/\${DB_NAME}_\${DATE}.sql"

# Mantener solo los últimos 7 días de backups
find \$BACKUP_DIR -name "${DB_NAME}_*.sql.gz" -mtime +7 -delete

echo "Backup completado: \$BACKUP_DIR/\${DB_NAME}_\${DATE}.sql.gz"
echo "\$(date): Backup completado - \${DB_NAME}_\${DATE}.sql.gz" >> /var/log/vibra/backup.log
EOF

chmod +x /usr/local/bin/vibra-backup

# ==========================================
# SCRIPT DE HEALTH CHECK
# ==========================================
log_step "Creando script de health check..."

cat > /usr/local/bin/vibra-health << 'EOF'
#!/bin/bash
# Verificar estado de todos los servicios

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  VibraTickets - Health Check"
echo "=========================================="
echo ""

# Verificar servicios
check_service() {
    if systemctl is-active --quiet "$1"; then
        echo -e "${GREEN}✓${NC} $1: Running"
    else
        echo -e "${RED}✗${NC} $1: Not running"
    fi
}

echo "Servicios del sistema:"
check_service "mariadb"
check_service "redis-server"
check_service "nginx"
echo ""

# Verificar PM2
echo "PM2 Status:"
pm2 list 2>/dev/null || echo -e "${RED}PM2 no está ejecutando procesos${NC}"
echo ""

# Verificar endpoints
echo "Endpoints:"
BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$BACKEND_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Backend API: HTTP $BACKEND_STATUS"
else
    echo -e "${RED}✗${NC} Backend API: HTTP $BACKEND_STATUS"
fi

NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [ "$NGINX_STATUS" = "200" ] || [ "$NGINX_STATUS" = "304" ]; then
    echo -e "${GREEN}✓${NC} Nginx Frontend: HTTP $NGINX_STATUS"
else
    echo -e "${YELLOW}!${NC} Nginx Frontend: HTTP $NGINX_STATUS"
fi

echo ""
echo "=========================================="
EOF

chmod +x /usr/local/bin/vibra-health

# ==========================================
# CRONTAB PARA BACKUPS
# ==========================================
log_step "Configurando backups automáticos..."
echo "0 2 * * * /usr/local/bin/vibra-backup >/dev/null 2>&1" | crontab -

# ==========================================
# LÍMITES DEL SISTEMA
# ==========================================
log_step "Configurando límites del sistema..."

cat >> /etc/security/limits.conf << EOF
# VibraTickets
$APP_USER soft nofile 65536
$APP_USER hard nofile 65536
$APP_USER soft nproc 32768
$APP_USER hard nproc 32768
EOF

cat >> /etc/sysctl.conf << EOF
# VibraTickets - Aumentar límites de conexiones
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
fs.file-max = 2097152
vm.swappiness = 10
EOF

sysctl -p 2>/dev/null || true

# ==========================================
# RESUMEN FINAL
# ==========================================
echo ""
echo "=========================================="
echo "  Setup completado exitosamente!"
echo "=========================================="
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Clonar el repositorio:"
echo "   su - $APP_USER"
echo "   git clone <tu-repositorio> $APP_DIR"
echo "   exit"
echo ""
echo "2. Configurar variables de entorno:"
echo "   vibra-setup-env"
echo "   # Luego edita el archivo .env con tus credenciales"
echo ""
echo "3. Desplegar la aplicación:"
echo "   vibra-deploy"
echo ""
echo "4. Verificar estado:"
echo "   vibra-health"
echo ""
echo "=========================================="
echo "Credenciales de Base de Datos (GUARDADAS)"
echo "=========================================="
echo "Archivo: /root/.vibra/db-credentials.txt"
echo ""
echo "Database Name: ${DB_NAME}"
echo "Database User: ${DB_USER}"
echo "Database Password: ${DB_PASSWORD}"
echo ""
echo "Comandos disponibles:"
echo "  vibra-setup-env    - Configurar archivos .env"
echo "  vibra-deploy       - Desplegar aplicación"
echo "  vibra-backup       - Crear backup manual"
echo "  vibra-health       - Verificar estado"
echo ""
echo "Para ver las credenciales completas:"
echo "  cat /root/.vibra/db-credentials.txt"
echo ""
