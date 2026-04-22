#!/bin/bash

# Configuration
PROJECT_ROOT="/var/www/vibratickets/admin"
APP_DIR="$PROJECT_ROOT/source"
TARGET_DIR="$PROJECT_ROOT/dist"
BACKEND_URL="http://vibratickets.com"

echo "🚀 Iniciando despliegue de VibraTicket Admin Panel..."

# 1. Navegar al directorio del código
cd "$APP_DIR" || { echo "❌ Error: No se encontró el directorio $APP_DIR"; exit 1; }

# 2. Actualizar código (opcional, si usas git)
# echo "📥 Actualizando código desde Git..."
# git pull

# 3. Instalar dependencias
echo "📦 Instalando dependencias con pnpm..."
pnpm install --frozen-lockfile

# 4. Construir el proyecto
echo "🏗️ Construyendo el proyecto para producción..."
pnpm build

# 5. Desplegar archivos
echo "📂 Desplegando archivos a $TARGET_DIR..."
# Asegurarse de que el directorio existe
mkdir -p "$TARGET_DIR"
# Limpiar el directorio destino y copiar el nuevo build
rm -rf "$TARGET_DIR/*"
cp -r "$APP_DIR/dist/"* "$TARGET_DIR/"

# 6. Permisos
echo "🔒 Ajustando permisos..."
chown -R www-data:www-data "$TARGET_DIR"

# 7. Reiniciar Nginx (opcional si la config no cambió)
echo "🌐 Reiniciando Nginx..."
sudo systemctl reload nginx

echo "✅ Despliegue completado con éxito!"
echo "Accede en: http://admin.vibratickets.com (o tu subdominio configurado)"
