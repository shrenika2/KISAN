import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-bootstrap') || id.includes('bootstrap')) return 'ui';
            if (id.includes('react/') || id.includes('react-dom/') || id.includes('scheduler/') || id.includes('react-is/')) return 'vendor';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('html2canvas') || id.includes('purify') || id.includes('jspdf')) return 'utils';
          }
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
      // Socket.io: connect from the client to http://localhost:5000 (see getSocketURL).
      // Proxying /socket.io through Vite often causes ECONNRESET / ECONNABORTED.
    }
  }
})
