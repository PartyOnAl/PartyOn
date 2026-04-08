import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        home: path.resolve(__dirname, 'home.html'),
        homeTopMenu: path.resolve(__dirname, 'home-top-menu.html'),
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
      },
    },
  },
})
