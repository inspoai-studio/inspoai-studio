import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    historyApiFallback: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'firebase/app', 'firebase/auth'],
          ui: ['@heroicons/react', 'lucide-react', 'react-icons', 'gsap'],
          utils: ['html2canvas', 'jspdf', 'dom-to-image-more']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
