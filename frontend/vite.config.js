import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// @contract resolves to the repo-root /contract directory. Those JSON files are
// the single source of truth shared with the backend — the frontend mocks import
// them rather than keeping a second copy that can silently drift.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@contract': fileURLToPath(new URL('../contract', import.meta.url)),
    },
  },
  server: {
    port: 5173,
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
