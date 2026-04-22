# VibraTickets - VPS Deployment Guide

Guía completa para desplegar VibraTickets en un VPS.

## Requisitos del VPS

- **Sistema Operativo**: Ubuntu 22.04 LTS o 24.04 LTS
- **RAM**: Mínimo 2GB (recomendado 4GB)
- **CPU**: 2 vCPUs mínimo
- **Disco**: 20GB SSD mínimo
- **Puertos**: 22 (SSH), 80 (HTTP), 443 (HTTPS)

## Proveedores recomendados

- DigitalOcean (Droplet $6-$12/mes)
- Hetzner (CX21 €4.51/mes)
- AWS Lightsail ($5/mes)
- Vultr ($6/mes)

---

## Paso 1: Configurar el VPS (Setup Automático)

### 1.1 Conectarte al VPS

```bash
ssh root@TU_IP_DEL_VPS
```

### 1.2 Ejecutar el script de setup

Copia el archivo `vps-setup.sh` al VPS y ejecútalo:

```bash
# Desde tu máquina local, copiar el archivo
scp deploy/vps-setup.sh root@TU_IP_DEL_VPS:/tmp/

# Conectarte al VPS
ssh root@TU_IP_DEL_VPS

# Ejecutar el script
cd /tmp
chmod +x vps-setup.sh
./vps-setup.sh
```

Este script **automáticamente** instalará y configurará:

✅ **MariaDB 10.11** - Base de datos
- Crea la base de datos `ticketera`
- Crea el usuario con contraseña segura
- Configura permisos automáticamente

✅ **Node.js 20 + PM2** - Runtime y process manager

✅ **Redis** - Cache y sesiones

✅ **Nginx** - Web server/reverse proxy

✅ **Usuario `vibra`** - Para ejecutar la aplicación

✅ **Scripts de automatización:**
- `vibra-setup-env` - Configura automáticamente los archivos .env
- `vibra-deploy` - Despliega la aplicación
- `vibra-backup` - Crea backups de la base de datos
- `vibra-health` - Verifica el estado de todos los servicios

**Credenciales generadas automáticamente** se guardan en:
```bash
cat /root/.vibra/db-credentials.txt
```

---

## Paso 2: Clonar el Repositorio

```bash
# Cambiar al usuario de la aplicación
su - vibra

# Clonar el repositorio (ajusta la URL)
cd /var/www/vibra
git clone https://github.com/tu-usuario/vibra.git .

# O si tienes los archivos localmente, cópialos
exit  # Salir del usuario vibra (volver a root)
# Copiar archivos desde tu máquina local
scp -r /ruta/local/del/proyecto/* vibra@TU_IP:/var/www/vibra/
```

---

## Paso 3: Configurar Variables de Entorno

### Opción A: Configuración Automática (Recomendada)

El script `vibra-setup-env` creará automáticamente los archivos `.env` con valores predeterminados:

```bash
# Ejecutar como root o con sudo
vibra-setup-env
```

Esto creará:
- `/var/www/vibra/ApiTickets/.env` - Configuración del backend
- `/var/www/vibra/VibraTicketsFrontend/.env` - Configuración del frontend

### Opción B: Configuración Manual

#### Backend

```bash
# Ver las credenciales de base de datos generadas
cat /root/.vibra/db-credentials.txt

# Crear archivo .env
nano /var/www/vibra/ApiTickets/.env
```

Contenido mínimo requerido:
```bash
# Server Configuration
PORT=3000
NODE_ENV=production
BASE_URL=http://TU_IP_O_DOMINIO

# Database Configuration (MariaDB) - Usar las credenciales generadas
DB_HOST=localhost
DB_PORT=3306
DB_USER=vibra_user
DB_PASSWORD=CONTRASEÑA_GENERADA
DB_NAME=ticketera

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=CONTRASEÑA_GENERADA

# CORS Configuration
ALLOWED_ORIGINS=*

# JWT Configuration (generar valores seguros)
JWT_SECRET=GENERA_CON: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
SESSION_SECRET=GENERA_OTRA_CON_EL_MISMO_COMANDO

# MercadoPago Configuration (REEMPLAZAR CON TUS CREDENCIALES)
MP_ACCESS_TOKEN=TEST-your-access-token-here
MP_PUBLIC_KEY=TEST-your-public-key-here
MP_WEBHOOK_SECRET=your_webhook_secret_here

# Queue Configuration
QUEUE_MAX_SIZE=1000
QUEUE_TIMEOUT_MINUTES=15
HOLD_MINUTES=7

# Health Check
HEALTH_ALLOW_DEGRADED=true
```

#### Frontend

```bash
nano /var/www/vibra/VibraTicketsFrontend/.env
```

```bash
VITE_API_URL=http://TU_IP_O_DOMINIO/api
VITE_APP_NAME=VibraTickets
```

---

## Paso 4: Desplegar la Aplicación

### Despliegue Automático

```bash
# Como root (o con sudo)
vibra-deploy
```

Este comando:
1. Instala dependencias del backend
2. Ejecuta migraciones de base de datos automáticamente
3. Inicia/Reinicia el backend con PM2
4. Instala dependencias del frontend
5. Compila el frontend
6. Recarga Nginx
7. Verifica que todo funcione correctamente

### Despliegue Manual (si prefieres control paso a paso)

```bash
# Backend
cd /var/www/vibra/ApiTickets
npm ci --production

# Ejecutar migraciones
npm run db:migrate:all  # o: node scripts/run-migrations.js

# Iniciar con PM2
pm2 start ecosystem.config.js --env production
pm2 save

# Frontend
cd /var/www/vibra/VibraTicketsFrontend
npm ci
npm run build

# Recargar Nginx
sudo systemctl reload nginx
```

---

## Paso 5: Verificar el Despliegue

```bash
# Verificar estado de todos los servicios
vibra-health
```

Deberías ver algo como:
```
==========================================
  VibraTickets - Health Check
==========================================

Servicios del sistema:
✓ mariadb: Running
✓ redis-server: Running
✓ nginx: Running

PM2 Status:
✓ ticketera-api: Online

Endpoints:
✓ Backend API: HTTP 200
✓ Nginx Frontend: HTTP 200
```

---

## Paso 6: Configurar tu Dominio

### 6.1 Configurar DNS

Apunta tu dominio/subdominio a la IP del VPS:

```
Type: A
Name: @ (o www, o app)
Value: TU_IP_DEL_VPS
TTL: 3600
```

### 6.2 Actualizar Nginx con tu dominio

```bash
sudo nano /etc/nginx/sites-available/vibra
```

Cambiar:
```nginx
server_name _;
```

Por:
```nginx
server_name tudominio.com www.tudominio.com;
```

Verificar y recargar:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 6.3 Actualizar variables de entorno con el dominio

```bash
nano /var/www/vibra/ApiTickets/.env
# Cambiar:
BASE_URL=http://TU_IP
ALLOWED_ORIGINS=*
# Por:
BASE_URL=https://tudominio.com
ALLOWED_ORIGINS=https://tudominio.com

nano /var/www/vibra/VibraTicketsFrontend/.env
# Cambiar:
VITE_API_URL=http://TU_IP/api
# Por:
VITE_API_URL=https://tudominio.com/api
```

Reconstruir el frontend:
```bash
cd /var/www/vibra/VibraTicketsFrontend
npm run build
```

---

## Paso 7: Configurar SSL (HTTPS)

### 7.1 Instalar Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Obtener certificado SSL

```bash
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

Sigue las instrucciones interactivas.

### 7.3 Verificar renovación automática

```bash
sudo certbot renew --dry-run
```

---

## Comandos Útiles

### Gestión del Backend (PM2)

```bash
# Ver estado
pm2 status

# Ver logs en tiempo real
pm2 logs

# Ver logs específicos (últimas 100 líneas)
pm2 logs ticketera-api --lines 100

# Reiniciar
pm2 restart ticketera-api

# Recargar sin downtime
pm2 reload ticketera-api

# Detener
pm2 stop ticketera-api

# Monitoreo en tiempo real
pm2 monit
```

### Base de Datos (MariaDB)

```bash
# Acceder a MariaDB (usando las credenciales generadas)
mysql -u vibra_user -p ticketera

# Ver las credenciales
cat /root/.vibra/db-credentials.txt

# Backup manual
vibra-backup

# Ver backups existentes
ls -la /var/backups/vibra/

# Restaurar un backup
gunzip < /var/backups/vibra/ticketera_20240115_120000.sql.gz | mysql -u vibra_user -p ticketera
```

### Nginx

```bash
# Verificar configuración
sudo nginx -t

# Recargar configuración
sudo systemctl reload nginx

# Ver logs de acceso
sudo tail -f /var/log/nginx/vibra-access.log

# Ver logs de errores
sudo tail -f /var/log/nginx/vibra-error.log
```

### Logs del Sistema

```bash
# Logs de despliegue
tail -f /var/log/vibra/deploy.log

# Logs de backups
tail -f /var/log/vibra/backup.log

# Logs de PM2
~/.pm2/logs/
```

---

## Actualizaciones

Para actualizar la aplicación cuando hay cambios en el código:

```bash
# Método 1: Usar el comando personalizado (recomendado)
vibra-deploy

# Método 2: Manual completo
cd /var/www/vibra
git pull origin main
cd ApiTickets && npm ci --production && pm2 reload ecosystem.config.js --env production
cd ../VibraTicketsFrontend && npm ci && npm run build
sudo systemctl reload nginx
```

---

## Solución de Problemas

### Error 502 Bad Gateway

```bash
# Verificar que el backend esté corriendo
pm2 status
pm2 logs ticketera-api

# Verificar puerto
sudo netstat -tlnp | grep 3000

# Verificar que MariaDB esté corriendo
sudo systemctl status mariadb
mysqladmin ping
```

### Error de CORS

```bash
# Verificar configuración
nano /var/www/vibra/ApiTickets/.env
# Asegúrate de que ALLOWED_ORIGINS incluya tu dominio:
# ALLOWED_ORIGINS=https://tudominio.com,https://www.tudominio.com

# Reiniciar backend
pm2 restart ticketera-api
```

### Base de datos no conecta

```bash
# Verificar MariaDB
sudo systemctl status mariadb

# Verificar credenciales
cat /root/.vibra/db-credentials.txt
mysql -u vibra_user -p ticketera

# Ver logs de MariaDB
sudo tail -f /var/log/mysql/error.log
```

### Redis no conecta

```bash
sudo systemctl status redis-server
redis-cli ping
```

### Problemas de permisos

```bash
sudo chown -R vibra:vibra /var/www/vibra
sudo chmod -R 755 /var/www/vibra
sudo chmod 600 /var/www/vibra/ApiTickets/.env
```

---

## Monitoreo y Alertas

### Configurar alertas de disco

```bash
# Agregar a crontab
crontab -e

# Añadir línea para verificar disco cada 30 minutos:
*/30 * * * * df -h / | awk '{print $5}' | tail -1 | sed 's/%//' | awk '{ if($1 > 80) print "Disk usage: " $1 "%" }' | mail -s "VPS Alert" tu-email@dominio.com
```

### Fail2Ban (protección contra ataques)

```bash
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Estructura de Archivos

```
/var/www/vibra/
├── ApiTickets/              # Backend
│   ├── .env                 # Variables de entorno
│   ├── server.js           # Entry point
│   ├── ecosystem.config.js # PM2 config
│   ├── uploads/            # Archivos subidos
│   └── ...
├── VibraTicketsFrontend/    # Frontend
│   ├── .env                # Variables de entorno
│   ├── dist/               # Build estático
│   └── ...
└── deploy/                  # Scripts de despliegue
    ├── vps-setup.sh
    └── ...

/var/log/vibra/              # Logs de la aplicación
/var/backups/vibra/          # Backups de base de datos
/root/.vibra/               # Credenciales y configuración sensible
```

---

## Soporte

Si encuentras problemas:

1. Verifica los logs: `pm2 logs` y `/var/log/vibra/`
2. Ejecuta el health check: `vibra-health`
3. Verifica la configuración: `sudo nginx -t`
4. Revisa que todos los servicios estén corriendo: `sudo systemctl status mariadb redis-server nginx`
