import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 走外部 CDN 时设 VITE_CDN_BASE（如 https://cdn.example.com/path），
 * base 会变成 <CDN>/site/。必须是构建期常量：Vite 把 base 写进 bundle，
 * 动态 import 的 chunk URL 由它拼出，只在服务端改 HTML 改不到。
 * 详见 apps/admin/vite.config.ts 的注释。
 */
const CDN_BASE = (process.env.VITE_CDN_BASE ?? '').trim().replace(/\/+$/, '');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: CDN_BASE ? `${CDN_BASE}/site/` : '/site/',
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
