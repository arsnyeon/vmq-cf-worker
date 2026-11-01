import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 静态资源基址用「运行时全局变量」而不是写死 base —— 原因见
 * apps/admin/vite.config.ts 的详细注释。简单说：后台的「静态资源地址」是
 * 运行时配置（D1 里的 config.resource_url），换域名不该需要重新构建。
 *
 * 前台目前没有懒加载 chunk，这个钩子暂时只对「被 JS 引用的资源」生效；
 * 加着是为了以后拆分代码时不会又踩同一个坑。
 */
const ASSET_BASE_VAR = 'window.__VMQ_ASSET_BASE__';
const BASE = '/site/';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: BASE,
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      if (hostType === 'js') {
        return { runtime: `(${ASSET_BASE_VAR} || "") + ${JSON.stringify(`${BASE}${filename}`)}` };
      }
      // CSS 里的 url() 写成相对路径，跟着 CSS 所在的 CDN 走
      if (hostType === 'css') return { relative: true };
      return undefined;
    },
  },
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
