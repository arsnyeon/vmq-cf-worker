/**
 * 提交前自检：仓库里不该出现线上真实信息。
 *
 * 两类规则：
 *   1. **通用规则**（写在本文件里）——开源用户也能用：闭源版表名前缀、
 *      疑似密钥字面量、个人收款码载荷。这些只是"形状"，不含任何真实值。
 *   2. **私有规则**——真实域名 / IP / 商户号放在 `.private-rules.json`（已 gitignore）。
 *      之所以不写在这里：**规则本身就是敏感值**，写进来等于又泄露一遍。
 *
 * 用法：pnpm check:leak
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const EXT = new Set(['.ts', '.mjs', '.js', '.json', '.jsonc', '.md', '.sql', '.html', '.example']);
const SKIP_DIR = new Set(['node_modules', '.wrangler', '.git', 'public', 'dist', '.data']);
const SKIP_FILE = new Set([
  'wrangler.local.jsonc',
  'seed.local.sql',
  'pnpm-lock.yaml',
  'package-lock.json',
  '.private-rules.json',
  // CDN 目标配置：存真实 bucket / 域名，本身就在 .gitignore 里，扫描它没有意义
  '.cdn.local.json',
]);

/** 通用规则：只有"形状"，不含真实值 */
const RULES = [
  { name: '闭源版表名', re: /\bzz_[a-z_]+/g },
  {
    name: '疑似密钥字面量',
    re: /(?:epaykey_ali|admin_secret|cron_key|merchant_key|app_key)[^\n]{0,20}?['"]([a-f0-9]{32})['"]/g,
  },
  // 个人收款码载荷（微信 wxp://、支付宝当面付）
  { name: '疑似个人收款码', re: /wxp:\/\/[A-Za-z0-9_-]{20,}/g },
];

/** 私有规则：真实域名 / IP / 商户号 */
const PRIVATE = '.private-rules.json';
if (existsSync(PRIVATE)) {
  try {
    const cfg = JSON.parse(readFileSync(PRIVATE, 'utf8'));
    for (const lit of cfg.leakLiterals ?? []) {
      if (!lit) continue;
      RULES.push({ name: `私有值 ${lit.slice(0, 6)}…`, re: new RegExp(escapeRe(lit), 'g') });
    }
  } catch (e) {
    console.warn(`⚠️  ${PRIVATE} 解析失败，仅使用通用规则：${e.message}`);
  }
} else {
  console.warn(`ℹ️  未找到 ${PRIVATE}，仅使用通用规则（开源用户默认如此）`);
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name) || SKIP_FILE.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      walk(p);
      continue;
    }
    if (!EXT.has(extname(name))) continue;
    const text = readFileSync(p, 'utf8');
    for (const { name: rule, re } of RULES) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text))) {
        const line = text.slice(0, m.index).split('\n').length;
        hits.push({ file: p.replace(/^\.\//, ''), line, rule, sample: m[0].slice(0, 46) });
      }
    }
  }
}

walk('.');

if (hits.length === 0) {
  console.log('✓ 未发现线上真实信息（域名 / IP / 商户号 / 密钥 / 收款码）');
  process.exit(0);
}

console.error(`✗ 发现 ${hits.length} 处疑似泄露：\n`);
for (const h of hits) {
  console.error(`  ${h.file}:${h.line}  [${h.rule}]  ${h.sample}`);
}
console.error('\n真实值请放 wrangler.local.jsonc / seed.local.sql / .private-rules.json（都已在 .gitignore 里）。');
process.exit(1);
