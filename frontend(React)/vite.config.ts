import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
        '/event': { target: apiTarget, changeOrigin: true },
        '/users': { target: apiTarget, changeOrigin: true },
        '/me': { target: apiTarget, changeOrigin: true },
        '/dashboard': { target: apiTarget, changeOrigin: true },
        '/staff': { target: apiTarget, changeOrigin: true },
        '/admin': { target: apiTarget, changeOrigin: true },
        '/clubs': { target: apiTarget, changeOrigin: true },
        '/payment': { target: apiTarget, changeOrigin: true },
        '/saved': { target: apiTarget, changeOrigin: true },
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
