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
 *
 * 走外部 CDN 时设 VITE_CDN_BASE（如 https://cdn.example.com/path），
 * base 会变成 <CDN>/console/。
 * 这一项必须是**构建期**的：Vite 会把 base 当成字符串常量写进 bundle
 * （产物里能看到 `t=function(u){return"/console/"+u}`），懒加载 chunk 的 URL
 * 就由它拼出来。只在服务端改写 HTML 是改不到这个常量的，那些 chunk 会回落到
 * 当前页面域名（Worker 自己），CDN 就白配了。
 */
const CDN_BASE = (process.env.VITE_CDN_BASE ?? '').trim().replace(/\/+$/, '');

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: CDN_BASE ? `${CDN_BASE}/console/` : '/console/',
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
