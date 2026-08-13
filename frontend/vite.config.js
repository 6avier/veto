import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // 5173 by default so the documented dev URL stays true; PORT lets a harness
    // or a busy machine place the server elsewhere without editing this file.
    port: Number(process.env.PORT) || 5173,
    // No fs.allow escape hatch. It existed so the dev server could read
    // /contract for the mocks; nothing outside the Vite root is imported any
    // more, and while it was set, `vite --host` served the whole repo over the
    // LAN — backend/db.sqlite3 and settings.py answered 200. (.env was never
    // exposed; Vite denies it regardless.)
    // Same-origin in dev, so no CORS preflight while developing.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
