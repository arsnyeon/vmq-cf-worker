import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 构建产物直接落到 Worker 的 assets 目录（public/console），
 * 由 Cloudflare 边缘分发 —— 不需要单独部署，也不需要 CORS。
 *
 * base 固定 '/console/'：SPA 里所有 js/css 都用绝对路径引用，
 * 但 HTML 可以由 Worker 从任意入口（例如 /{别名}/app）返回。
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/console/',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    outDir: '../../public/console',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // 本地开发：把 /api 代理到 wrangler dev，cookie 同源
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: false,
      },
    },
  },
});
