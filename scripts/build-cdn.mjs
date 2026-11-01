#!/usr/bin/env node
/**
 * 带 CDN 基址构建前端（apps/admin + apps/web）。
 *
 * 为什么需要单独一个脚本：
 *   Vite 的 base 是**构建期常量**，会被写进 bundle
 *   （产物里能看到 `t=function(u){return"/console/"+u}`），
 *   动态 import 的 chunk URL 就由它拼出来。
 *   如果只在服务端改写 HTML，懒加载的 chunk 仍然会回落到当前页面域名，
 *   结果是「主 bundle 走 CDN、其余 chunk 全走 Worker」——CDN 白配一半。
 *
 * 所以构建前要把 base 设成 CDN 地址。这个脚本从 .cdn.local.json 读 cdnBase，
 * 通过环境变量 VITE_CDN_BASE 传给两个 vite.config.ts。
 *
 * 用法：
 *   pnpm build:cdn     构建（产物里的资源路径指向 CDN）
 *   pnpm cdn:sync      上传
 *   pnpm run deploy    发布
 *
 * 不设 CDN 时照常用 `pnpm admin:build && pnpm web:build`（base 是相对路径）。
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = process.env.CDN_CONFIG || join(ROOT, '.cdn.local.json');

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

if (!existsSync(CONFIG_FILE)) {
  die(
    `缺少 ${CONFIG_FILE}\n` +
      `  复制模板后填真实值：cp .cdn.example.json .cdn.local.json\n` +
      `  （不打算用 CDN 的话，直接用 pnpm admin:build && pnpm web:build）`
  );
}

let cfg;
try {
  cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
} catch (e) {
  die(`解析 ${CONFIG_FILE} 失败：${e.message}`);
}

const cdnBase = String(cfg.cdnBase ?? '').trim().replace(/\/+$/, '');
if (!cdnBase) die(`${CONFIG_FILE} 缺少 cdnBase`);
if (!/^https?:\/\//i.test(cdnBase)) die(`cdnBase 必须以 http:// 或 https:// 开头：${cdnBase}`);

console.log(`\n带 CDN 基址构建`);
console.log(`  VITE_CDN_BASE  ${cdnBase}`);
console.log(`  admin base     ${cdnBase}/console/`);
console.log(`  web   base     ${cdnBase}/site/\n`);

const env = { ...process.env, VITE_CDN_BASE: cdnBase };

for (const [label, script] of [
  ['admin', 'admin:build'],
  ['web', 'web:build'],
]) {
  process.stdout.write(`  ${label.padEnd(6)} `);
  const r = spawnSync('pnpm', [script], { cwd: ROOT, env, stdio: 'inherit' });
  if (r.status !== 0) die(`${script} 失败（exit ${r.status}）`);
  console.log(`  ✓ ${label} 构建完成\n`);
}

console.log('完成。下一步：pnpm cdn:sync\n');
