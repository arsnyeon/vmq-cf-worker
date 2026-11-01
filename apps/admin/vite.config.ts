import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 构建产物直接落到 Worker 的 assets 目录（public/console），
 * 由 Cloudflare 边缘分发 —— 不需要单独部署，也不需要 CORS。
 *
 * ## 静态资源基址为什么用「运行时全局变量」而不是 base
 *
 * 后台的「静态资源地址」是**运行时**配置（存在 D1 的 config.resource_url），
 * 所以 CDN 域名/路径不能写死在构建产物里。
 *
 * 但麻烦在于：Vite 会把 base 当成**字符串常量**编进 bundle ——
 * 产物里能看到 `t=function(u){return"/console/"+u}`，懒加载 chunk 的 URL
 * 由它拼出来。只在服务端改写 HTML 里的 <script src> 是改不到这个常量的，
 * 那些 chunk 会回落成 `/console/...`，浏览器按当前页面域名解析，
 * 结果就是「入口走 CDN、chunk 全走 Worker」。
 *
 * 解法：`experimental.renderBuiltUrl` 对 hostType === 'js' 返回 runtime 表达式，
 * Vite 会把这段**表达式原样编进 bundle**，在浏览器里才求值：
 *
 *   import("./page-shell-xxx.js")  →  import(window.ASSET_BASE + "/console/assets/page-shell-xxx.js")
 *
 * ASSET_BASE 由 Worker 渲染 HTML 时注入（值取 config.resource_url），
 * 所以换域名、留空退回相对路径，都不需要重新构建。
 *
 * css / html 保持默认（仍然按 base 生成绝对路径），由服务端的
 * rewriteAssetUrls 在返回 HTML 时替换成 CDN 地址 —— 那部分本来就是动态的。
 */
const ASSET_BASE_VAR = 'window.__VMQ_ASSET_BASE__';
const BASE = '/console/';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: BASE,
  experimental: {
    renderBuiltUrl(filename, { hostType }) {
      // 只有「被 JS 引用的资源」需要运行时求值（懒加载 chunk 就在这里）。
      // 用 `|| ""` 兜底：万一 HTML 没注入这个全局（例如直接跑 vite dev），
      // 表达式会退化成 /console/... 的绝对路径，仍然能加载，只是不走 CDN。
      if (hostType === 'js') {
        return { runtime: `(${ASSET_BASE_VAR} || "") + ${JSON.stringify(`${BASE}${filename}`)}` };
      }
      // CSS 里没法写 JS 表达式，改成相对路径——CSS 本身在 CDN 上，
      // 相对 url() 会按 CSS 的地址解析，同样能落到 CDN。
      if (hostType === 'css') return { relative: true };
      return undefined;
    },
  },
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
