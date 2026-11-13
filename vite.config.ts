import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const API_PORT = process.env.PORT ?? '4000'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // The crew database API (server/server.mjs) runs on :4000 (or PORT); the website calls it as /api/...
  // Same-origin through this proxy, so the httpOnly session cookie works without CORS.
  server: {
    proxy: { '/api': `http://localhost:${API_PORT}` },
  },
  // Charts (recharts) and React load as separate files, so pages without charts open faster on the tablet.
  build: {
    // Served from the same laptop (no internet download), ~150 kB gzipped: fine for this app.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          react: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  preview: {
    proxy: { '/api': `http://localhost:${API_PORT}` },
  },
})
