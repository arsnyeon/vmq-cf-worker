#!/usr/bin/env node
/**
 * 把构建产物同步到外部 CDN（阿里云 OSS + CDN）。
 *
 * 为什么需要：站点部署在 Cloudflare Workers，而 CF 边缘不覆盖中国大陆。
 * 大陆用户访问 /console/assets/*.js 这类资源会很慢，所以把「JS/CSS/图片」
 * 放到国内 CDN 上，由后台「系统配置 → 站点信息 → 静态资源地址」指向它。
 *
 * 为什么用 `cp -r -f` 而不是 `sync`：
 *   部分 OSS 账号只有对象级读写权限，没有桶级 ListObjects ——
 *   而 `ossutil sync` 必须先列目录算差异，会直接 403。
 *   `cp -r -f` 是「全量覆盖上传」，不依赖列举，实测可用。
 *   代价是无法增量，但三个目录合计约 1.2 MB / 37 个文件，全量只要 2-3 秒。
 *
 * 上传顺序很重要：**必须先传 CDN、再 wrangler deploy**。
 * 反过来的话，Worker 已经引用新 hash，而文件还没传上去，会出现一段 404 窗口
 *（例如后台白屏、CSS 正常但 JS 加载失败）。
 *
 * 用法：
 *   pnpm cdn:sync            上传 + 校验
 *   pnpm cdn:sync --dry-run  只打印将要上传的内容，不真传
 *   pnpm cdn:sync --no-verify 上传后不做 CDN 可达性校验
 *
 * 配置：读 .cdn.local.json（已在 .gitignore 中，模板见 .cdn.example.json）。
 */
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG_FILE = process.env.CDN_CONFIG || join(ROOT, '.cdn.local.json');

/**
 * ossutil 默认把批量操作的报告写进当前目录的 ossutil_output/，会污染仓库。
 * 统一改指到系统临时目录（--output-dir），项目里就不会冒出一堆 .report 文件。
 */
const OUTPUT_DIR = join(tmpdir(), 'vmq-cdn-ossutil');

/** 要上传的目录（相对 public/）。新增顶层资源目录时在这里补一行。 */
const DIRS = ['console', 'site', 'static'];

/**
 * 排除规则。
 *   *.html   —— 这些是 Vite 打出来的 SPA 外壳，由 Worker 读取后注入配置再返回，
 *               CDN 上那份没有任何地方会请求，传上去只是白泄露源码结构。
 *   .DS_Store —— macOS 目录垃圾。
 *   _headers  —— Cloudflare 专用缓存头配置，对 OSS 无意义。
 *
 * 刻意用「黑名单」而不是「白名单（--exclude "*" --include "*.js" ...）」：
 * 漏传的代价是多传的无数倍 —— 将来构建产物多出 .woff2 / .webp 之类新类型时，
 * 白名单会静默漏掉，线上直接 404；黑名单只是多传几个无害文件。
 */
const EXCLUDES = ['*.html', '.DS_Store', '_headers'];

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERIFY = !args.includes('--no-verify');

function die(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    die(
      `缺少 ${CONFIG_FILE}\n` +
        `  复制模板后填真实值：\n` +
        `    cp .cdn.example.json .cdn.local.json\n` +
        `  （.cdn.local.json 已在 .gitignore 里，不会进仓库）`
    );
  }
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    die(`解析 ${CONFIG_FILE} 失败：${e.message}`);
  }
  for (const k of ['bucket', 'prefix', 'region', 'cdnBase']) {
    if (!cfg[k]) die(`${CONFIG_FILE} 缺少字段 "${k}"`);
  }
  cfg.prefix = String(cfg.prefix).replace(/^\/+|\/+$/g, '');
  cfg.cdnBase = String(cfg.cdnBase).replace(/\/+$/, '');
  return cfg;
}

function checkOssutil() {
  const r = spawnSync('ossutil', ['version'], { encoding: 'utf8' });
  if (r.error || r.status !== 0) {
    die(
      '找不到 ossutil。安装方式（macOS arm64）：\n' +
        '  curl -sL -o /tmp/ossutil.zip \\\n' +
        '    "https://gosspublic.alicdn.com/ossutil/v2/2.1.2/ossutil-2.1.2-mac-arm64.zip"\n' +
        '  unzip -o -q /tmp/ossutil.zip -d /tmp/ossutil-pkg\n' +
        '  cp /tmp/ossutil-pkg/ossutil-2.1.2-mac-arm64/ossutil /opt/homebrew/bin/ossutil\n' +
        '  chmod +x /opt/homebrew/bin/ossutil\n' +
        '然后配置凭据：ossutil config（region 填 bucket 所在地域，如 cn-shanghai）'
    );
  }
  return r.stdout.trim().split('\n').pop();
}

/** 跑一次 ossutil cp -r -f，返回 { ok, objects, bytes, output } */
function uploadDir(cfg, dir) {
  const src = join(ROOT, 'public', dir);
  if (!existsSync(src)) {
    return { ok: false, objects: 0, bytes: 0, output: `本地目录不存在：public/${dir}（先 pnpm admin:build && pnpm web:build）` };
  }

  const dst = `oss://${cfg.bucket}/${cfg.prefix}/${dir}/`;
  const argv = ['cp', '-r', '-f', src, dst, '--region', cfg.region, '--output-dir', OUTPUT_DIR];
  for (const e of EXCLUDES) argv.push('--exclude', e);
  if (DRY_RUN) argv.push('--dry-run');

  const r = spawnSync('ossutil', argv, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;

  if (r.status !== 0) {
    // ossutil 的进度用 \r 刷新，直接截尾可能只剩半行，这里保留最后一段有用的文本
    const useful = out.replace(/\r/g, '\n').split('\n').filter(Boolean).slice(-4).join('\n');
    return { ok: false, objects: 0, bytes: 0, output: useful || '(无输出)' };
  }

  const mObj = out.match(/Upload done:\((\d+) objects?,\s*(\d+)\s*B/);
  const mTot = out.match(/Total (\d+) files?,\s*(\d+)\s*B/);
  const objects = Number(mObj?.[1] ?? mTot?.[1] ?? 0);
  const bytes = Number(mObj?.[2] ?? mTot?.[2] ?? 0);
  return { ok: true, objects, bytes, output: '' };
}

/**
 * 上传后校验：把构建产物 HTML 里引用到的资源改写成 CDN 地址，逐个 HEAD。
 *
 * 这一步专门用来抓「传了但漏了某类文件」——比如 CSS 传了、JS 没传，
 * 页面上看不出异常，但打开后台就是白屏。HEAD 一遍直接暴露。
 */
async function verify(cfg) {
  const targets = [];
  const re = /(?:src|href)="(\/(?:console|site|static)\/[^"]*)"/g;

  for (const html of ['public/console/index.html', 'public/site/index.html']) {
    const p = join(ROOT, html);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, 'utf8');
    for (const m of text.matchAll(re)) targets.push(m[1]);
  }

  const uniq = [...new Set(targets)];
  if (!uniq.length) return { checked: 0, failed: [] };

  const failed = [];
  for (const path of uniq) {
    const url = `${cfg.cdnBase}${path}`;
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      if (attempt) await new Promise((r) => setTimeout(r, 800));
      try {
        const res = await fetch(url, { method: 'HEAD' });
        ok = res.ok;
        if (!ok) failed.push({ url, status: res.status });
      } catch (e) {
        if (attempt === 1) failed.push({ url, status: String(e.message ?? e).slice(0, 60) });
      }
    }
  }
  return { checked: uniq.length, failed };
}

function fmtBytes(n) {
  if (!n) return '0 B';
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(2)} MB` : `${(n / 1024).toFixed(1)} KB`;
}

async function main() {
  const cfg = loadConfig();
  const ver = checkOssutil();
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`\n静态资源同步${DRY_RUN ? '（dry-run，不真传）' : ''}`);
  console.log(`  ossutil  ${ver}`);
  console.log(`  目标     oss://${cfg.bucket}/${cfg.prefix}/{${DIRS.join(',')}}/`);
  console.log(`  区域     ${cfg.region}`);
  console.log(`  排除     ${EXCLUDES.join(', ')}`);
  console.log('');

  let totalObjects = 0;
  let totalBytes = 0;
  const failures = [];

  for (const dir of DIRS) {
    process.stdout.write(`  ${dir.padEnd(8)} `);
    const r = uploadDir(cfg, dir);
    if (r.ok) {
      totalObjects += r.objects;
      totalBytes += r.bytes;
      console.log(`✓ ${String(r.objects).padStart(3)} 个对象  ${fmtBytes(r.bytes)}`);
    } else {
      failures.push({ dir, output: r.output });
      console.log('✗ 失败');
    }
  }

  if (failures.length) {
    console.error('\n上传失败：');
    for (const f of failures) console.error(`\n  [${f.dir}]\n  ${f.output.replace(/\n/g, '\n  ')}`);
    die(`${failures.length} 个目录上传失败，已中断（不要在这种状态下 deploy）`);
  }

  console.log(`\n  合计     ${totalObjects} 个对象  ${fmtBytes(totalBytes)}`);

  if (DRY_RUN) {
    console.log('\n  dry-run 结束，未实际上传。去掉 --dry-run 执行真实上传。\n');
    return;
  }

  if (VERIFY) {
    process.stdout.write('\n  CDN 校验 ');
    const v = await verify(cfg);
    if (!v.checked) {
      console.log('跳过（没找到构建产物 HTML）');
    } else if (v.failed.length) {
      console.log(`✗ ${v.failed.length}/${v.checked} 个资源不可达`);
      for (const f of v.failed) console.error(`     ${f.status}  ${f.url}`);
      die('CDN 上有资源缺失，请检查上面的 URL（常见原因：某类文件被排除规则漏掉，或上传中断）');
    } else {
      console.log(`✓ ${v.checked}/${v.checked} 个资源可访问`);
    }
  }

  console.log('\n完成。下一步：pnpm run deploy（务必在同步之后）\n');
}

main().catch((e) => die(String(e?.stack ?? e)));
