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
    server: {
      proxy: {
        '/catalog': { target: apiTarget, changeOrigin: true },
        '/auth': { target: apiTarget, changeOrigin: true },
        '/users': { target: apiTarget, changeOrigin: true },
        '/me': { target: apiTarget, changeOrigin: true },
        '/api': { target: apiTarget, changeOrigin: true },
        '/event': { target: apiTarget, changeOrigin: true },
        '/payment': { target: apiTarget, changeOrigin: true },
      },
    },
  }
})
