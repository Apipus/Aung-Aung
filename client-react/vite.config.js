import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:8080', // your Node server
        ws: true
      }
    }
  },
  build: { outDir: 'dist' }
})
