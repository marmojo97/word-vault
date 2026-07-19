import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite serves the React app from `client/`. In dev, /api requests are proxied to
// the Express server on :3001. In production, run `npm run build` and serve the
// `dist/` folder however you'd like (the Express server can serve it too).
export default defineConfig({
  plugins: [react()],
  root: 'client',
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
