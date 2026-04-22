# Guía de Despliegue - VibraTicket Panel Admin

Para desplegar el panel de administración en tu VPS, sigue estos pasos:

### 1. Preparar el Entorno en el VPS
Asegúrate de tener instalados:
- **Node.js** (v18 o superior)
- **pnpm**: `npm install -g pnpm`
- **Nginx**

### 2. Subir y Construir el Proyecto
En la carpeta `VibraTicketPanelAdm`:
```bash
# Instalar dependencias
pnpm install

# Construir para producción
pnpm build
```
Esto generará la carpeta `dist/`.

### 3. Configura Nginx
Usa el archivo de configuración generado: [nginx-admin.conf](file:///c:/Users/Lucas/Desktop/vibrtickets/deploy/nginx-admin.conf)

1. Copia el contenido a un nuevo archivo en el VPS:
   `sudo nano /etc/nginx/sites-available/vibraticket-admin`
2. Activa el sitio:
   `sudo ln -s /etc/nginx/sites-available/vibraticket-admin /etc/nginx/sites-enabled/`
3. Verifica la configuración y reinicia Nginx:
   `sudo nginx -t`
   `sudo systemctl restart nginx`

### 4. Automatización de Despliegue
He creado un script **[deploy-admin.sh](file:///c:/Users/Lucas/Desktop/vibrtickets/deploy/deploy-admin.sh)** que automatiza todo el proceso anterior (pnpm install, build, rm -rf dist, systemctl reload).

Solo tienes que subirlo al VPS y ejecutarlo:
`chmod +x deploy-admin.sh`
`./deploy-admin.sh`

### 5. Variables de Envío
Verifica que tu archivo `.env.production` tenga:
`VITE_API_URL=http://vibratickets.com`

¡Listo! El panel debería estar accesible en `http://admin.vibratickets.com`.
