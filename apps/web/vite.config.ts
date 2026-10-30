import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/site/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../../public/site',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        doc: resolve(__dirname, 'doc.html'),
        api: resolve(__dirname, 'api.html'),
        demo: resolve(__dirname, 'demo.html'),
        result: resolve(__dirname, 'result.html'),
        chaorder: resolve(__dirname, 'chaorder.html'),
      },
    },
  },
  server: { port: 5174 },
});
