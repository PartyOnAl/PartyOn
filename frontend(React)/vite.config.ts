import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Dev-only: reloads on SPA routes like /payment/:id must not hit the Nest API (JSON). */
function apiProxy(target: string) {
  return {
    target,
    changeOrigin: true,
    bypass(req: { method?: string; headers?: { accept?: string } }, _res: unknown, _options: unknown) {
      const accept = req.headers?.accept ?? ''
      if (req.method === 'GET' && accept.includes('text/html')) {
        return '/index.html'
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '')
  const apiTarget =
    env.VITE_API_PROXY_TARGET?.trim() ||
    env.VITE_API_URL?.trim() ||
    'http://localhost:3000'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          homeTopMenu: path.resolve(__dirname, 'home-top-menu.html'),
          managerDashboard: path.resolve(__dirname, 'manager/manager-dashboard.html'),
          clubProfileEditor: path.resolve(__dirname, 'manager/club-profile-editor.html'),
          eventManagement: path.resolve(__dirname, 'manager/event-management.html'),
          reservationManagement: path.resolve(__dirname, 'manager/reservation-management.html'),
        },
      },
    },
    server: {
      proxy: {
        '/catalog': { target: apiTarget, changeOrigin: true },
        '/suggestions': { target: apiTarget, changeOrigin: true },
        '/auth': { target: apiTarget, changeOrigin: true },
        '/event': apiProxy(apiTarget),
        '/users': { target: apiTarget, changeOrigin: true },
        '/me': { target: apiTarget, changeOrigin: true },
        '/payment': apiProxy(apiTarget),
        '/dashboard': { target: apiTarget, changeOrigin: true },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
