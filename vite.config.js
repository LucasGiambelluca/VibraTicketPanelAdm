import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all envs regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // Use VITE_API_URL if it's a full URL, otherwise use a default or the same as production
  // For local proxying to VPS, we can hardcode it or use another variable
  const apiTarget = env.VITE_API_TARGET || 'https://admin.vibratickets.online';

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.js',
      css: false,
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5174,
      host: true,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
          cookieDomainRewrite: "", // Rewrite cookie domain to match the dev server
          // DEV-ONLY: la cookie de prod es Secure;SameSite=None y no se guarda en http://localhost.
          // Reescribimos Set-Cookie para que funcione en el dev server. No afecta producción (vite.config no se deploya).
          configure: (proxy) => {
            // DEV-ONLY: el backend de prod whitelistea por Origin. Reescribimos el Origin
            // a un dominio permitido para pasar el CORS desde el dev server local.
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('origin', 'https://admin.vibratickets.online');
            });
            proxy.on('proxyRes', (proxyRes) => {
              const sc = proxyRes.headers['set-cookie'];
              if (sc) {
                proxyRes.headers['set-cookie'] = sc.map((c) =>
                  c.replace(/;\s*Secure/gi, '').replace(/SameSite=None/gi, 'SameSite=Lax')
                );
              }
            });
          },
        },
        '/uploads': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    }
  };
})
