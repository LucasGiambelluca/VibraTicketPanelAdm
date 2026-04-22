#!/bin/bash
# VibraTickets Health Check Script
# Verifica que todos los servicios estén funcionando

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=========================================="
echo "  VibraTickets - Health Check"
echo "=========================================="
echo ""

# Función de verificación
check_service() {
    local service=$1
    local status

    if systemctl is-active --quiet "$service" 2>/dev/null; then
        echo -e "${GREEN}✓${NC} $service: Running"
        return 0
    else
        echo -e "${RED}✗${NC} $service: Not running"
        return 1
    fi
}

check_port() {
    local port=$1
    local name=$2

    if netstat -tlnp 2>/dev/null | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} $name (port $port): Listening"
        return 0
    else
        echo -e "${RED}✗${NC} $name (port $port): Not listening"
        return 1
    fi
}

# Verificar servicios del sistema
echo "Servicios del Sistema:"
check_service "mysql" || true
check_service "redis-server" || true
check_service "nginx" || true
echo ""

# Verificar puertos
echo "Puertos:"
check_port "3000" "Node.js API" || true
check_port "3306" "MySQL" || true
check_port "6379" "Redis" || true
check_port "80" "Nginx HTTP" || true
check_port "443" "Nginx HTTPS" || true
echo ""

# Verificar PM2
echo "PM2 Status:"
if command -v pm2 >/dev/null 2>&1; then
    pm2_list=$(pm2 list 2>/dev/null || true)
    if echo "$pm2_list" | grep -q "ticketera-api"; then
        if echo "$pm2_list" | grep "ticketera-api" | grep -q "online"; then
            echo -e "${GREEN}✓${NC} ticketera-api: Online"
        else
            echo -e "${YELLOW}!${NC} ticketera-api: Offline or errored"
        fi
    else
        echo -e "${RED}✗${NC} ticketera-api: Not found in PM2"
    fi
else
    echo -e "${YELLOW}!${NC} PM2 not installed"
fi
echo ""

# Verificar endpoints HTTP
echo "Endpoints HTTP:"

# Backend Health
backend_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health 2>/dev/null || echo "000")
if [ "$backend_status" = "200" ]; then
    echo -e "${GREEN}✓${NC} Backend Health: HTTP $backend_status"
else
    echo -e "${RED}✗${NC} Backend Health: HTTP $backend_status (expected 200)"
fi

# Nginx
nginx_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/ 2>/dev/null || echo "000")
if [ "$nginx_status" = "200" ] || [ "$nginx_status" = "304" ]; then
    echo -e "${GREEN}✓${NC} Nginx Frontend: HTTP $nginx_status"
else
    echo -e "${YELLOW}!${NC} Nginx Frontend: HTTP $nginx_status"
fi

echo ""

# Verificar espacio en disco
echo "Espacio en Disco:"
df -h / | awk 'NR==2 {printf "Usado: %s de %s (%s)\n", $3, $2, $5}'
usage=$(df -h / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ "$usage" -gt 80 ]; then
    echo -e "${RED}!${NC} Advertencia: Uso de disco superior al 80%"
fi
echo ""

# Verificar memoria
echo "Memoria:"
free -h | awk 'NR==2 {printf "Usada: %s de %s\n", $3, $2}'
echo ""

# Verificar logs recientes
echo "Errores recientes en logs (últimas 24h):"
log_count=0
if [ -f "/var/log/vibra/deploy.log" ]; then
    recent_errors=$(grep -i "error" /var/log/vibra/deploy.log 2>/dev/null | tail -5 || true)
    if [ -n "$recent_errors" ]; then
        echo "$recent_errors"
        log_count=$(echo "$recent_errors" | wc -l)
    fi
fi

if [ "$log_count" -eq 0 ]; then
    echo -e "${GREEN}✓${NC} No se encontraron errores recientes"
fi

echo ""
echo "=========================================="
echo "  Health Check completado"
echo "=========================================="
