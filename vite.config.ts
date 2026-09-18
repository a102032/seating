import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo under /seating/ rather than the domain root. Overridable
  // via BASE_PATH so the same build can target a root-hosted deploy or the demo artifact.
  base: process.env.BASE_PATH ?? '/seating/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
