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
          home: path.resolve(__dirname, 'home.html'),
          topClubs: path.resolve(__dirname, 'top-clubs.html'),
          promotions: path.resolve(__dirname, 'promotions.html'),
          getTheApp: path.resolve(__dirname, 'get-the-app.html'),
          header: path.resolve(__dirname, 'header.html'),
          footer: path.resolve(__dirname, 'footer.html'),
          search: path.resolve(__dirname, 'search.html'),
          eventClicked: path.resolve(__dirname, 'event-clicked.html'),
          payment: path.resolve(__dirname, 'payment.html'),
          paymentMethod: path.resolve(__dirname, 'payment-method.html'),
          purchasedTicket: path.resolve(__dirname, 'purchased-ticket.html'),
          managerDashboard: path.resolve(__dirname, 'manager-dashboard.html'),
          clubProfileEditor: path.resolve(__dirname, 'club-profile-editor.html'),
          eventManagement: path.resolve(__dirname, 'event-management.html'),
          reservationManagement: path.resolve(__dirname, 'reservation-management.html'),
        },
      },
    },
    server: {
      proxy: {
        '/catalog': { target: apiTarget, changeOrigin: true },
        '/auth': { target: apiTarget, changeOrigin: true },
        '/users': { target: apiTarget, changeOrigin: true },
        '/me': { target: apiTarget, changeOrigin: true },
        '/api': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
