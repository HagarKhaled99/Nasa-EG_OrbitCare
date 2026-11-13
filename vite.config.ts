import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The crew database API (server/server.mjs) runs on :4000; the website calls it as /api/...
  server: {
    proxy: { '/api': 'http://localhost:4000' },
  },
  preview: {
    proxy: { '/api': 'http://localhost:4000' },
  },
})
