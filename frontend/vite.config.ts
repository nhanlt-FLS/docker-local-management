import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The production build is emitted into ../public, which server.py serves as
// static files. During development the Vite dev server proxies /api to the
// Python backend so the same code works in both modes.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    outDir: '../public',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.DOCKER_UI_BACKEND || 'http://127.0.0.1:8420',
        changeOrigin: true,
        // Long-lived streaming endpoints (logs -f, stats, events, image pull).
        // No websocket upgrade is used, so ws stays disabled.
        ws: false,
      },
    },
  },
});
