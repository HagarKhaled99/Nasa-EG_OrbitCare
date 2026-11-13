// Vite is the tool that runs the app on your computer (npm run dev)
// and packs it into plain HTML/JS files for hosting (npm run build).
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
