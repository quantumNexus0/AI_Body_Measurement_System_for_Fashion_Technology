import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    proxy: {
      // All /api requests go to the Node.js gateway — never directly to Python
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Do NOT expose the Python backend port (8000) here.
        // The Python backend is a private microservice called only by Node.js.
      },
    },
  },
});
