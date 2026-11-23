import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    // По умолчанию Vite слушает только [::1], а pitchfork (mise daemons) ждёт порт по IPv4
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // В dev фронтенд и бэкенд на разных портах: /api проксируется на Fastify
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
  },
});
