import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// Dev runs in Profile A (same origin). Open the app at http://anna-finance.localhost:5173 so the
// Origin, the forwarded tenant host, and the seeded tenant slug all agree.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        headers: {
          'X-Forwarded-Host': 'anna-finance.localhost:5173',
        },
      },
    },
  },
})
