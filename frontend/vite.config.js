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
    // Allows the dev server to read /contract, which sits outside the Vite root.
    fs: { allow: ['..'] },
    // Same-origin in dev, so no CORS preflight while developing.
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
