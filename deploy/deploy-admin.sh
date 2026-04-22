#!/bin/bash

# Configuration
# Detect the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
APP_DIR="$(dirname "$SCRIPT_DIR")" # Assuming script is in /deploy folder
TARGET_DIR="/var/www/vibratickets/admin/dist"

echo "🚀 Iniciando despliegue de VibraTicket Admin Panel..."
echo "📂 Directorio de la App: $APP_DIR"

# 1. Navegar al directorio del código
cd "$APP_DIR" || { echo "❌ Error: No se pudo acceder a $APP_DIR"; exit 1; }

# 2. Instalar dependencias
echo "📦 Instalando dependencias con pnpm..."
pnpm install --frozen-lockfile

# 3. Construir el proyecto
echo "🏗️ Construyendo el proyecto para producción..."
pnpm build

# 4. Desplegar archivos
echo "📂 Desplegando archivos a $TARGET_DIR..."
# Asegurarse de que el directorio de destino existe
sudo mkdir -p "$TARGET_DIR"

# Limpiar el directorio destino y copiar el nuevo build
echo "🧹 Limpiando y copiando archivos..."
sudo rm -rf "$TARGET_DIR/*"
sudo cp -r "$APP_DIR/dist/"* "$TARGET_DIR/"

# 5. Permisos
echo "🔒 Ajustando permisos..."
sudo chown -R www-data:www-data "$TARGET_DIR"

# 6. Reiniciar Nginx
echo "🌐 Reiniciando Nginx..."
sudo systemctl reload nginx

echo "✅ Despliegue completado con éxito!"
echo "Accede en: http://admin.vibratickets.com (o tu subdominio configurado)"
