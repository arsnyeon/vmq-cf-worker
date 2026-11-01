/**
 * 泄露门禁：确认仓库及其 Git 历史里没有真实密钥、域名、账号或个人信息。
 *
 * 默认扫描三处：
 *   1. 可发布的工作区文件（git ls-files --cached --others --exclude-standard）
 *   2. 全部可达历史中的文本 blob（包括已删除的历史文件）
 *   3. 每条提交的说明、作者/提交者信息，以及附注标签的说明
 *
 * 两类规则：
 *   · **通用规则**（写在本文件里）——只有"形状"，不含任何真实值，开源用户也能用。
 *   · **私有规则**——真实域名 / IP / 商户号 / 姓名放在 `.private-rules.json`
 *     （已在 .gitignore 中）。规则本身是敏感值，所以不写进本文件，输出也只显示编号。
 *
 * 命中内容一律脱敏输出；确认为测试假值时，可在同一行加 `check-leak-ignore` 注释。
 *
 * 用法：
 *   pnpm check:leak            # 工作区 + 历史 + 提交信息
 *   pnpm check:leak:worktree   # 只查工作区
 *   pnpm check:leak:history    # 只查历史与提交信息
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PRIVATE_RULES_LABEL = '.private-rules.json';
const PRIVATE_RULES = fileURLToPath(new URL(`../${PRIVATE_RULES_LABEL}`, import.meta.url));
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_HITS = Number(process.env.CHECK_LEAK_MAX_HITS) || 200;

const args = new Set(process.argv.slice(2));
const onlyWorktree = args.has('--worktree');
const onlyHistory = args.has('--history');
if (onlyWorktree && onlyHistory) {
  console.error('✗ --worktree 与 --history 不能同时使用');
  process.exit(2);
}
const unknown = [...args].filter((a) => !['--worktree', '--history', '--help', '-h'].includes(a));
if (unknown.length || args.has('--help') || args.has('-h')) {
  console.log('用法：node scripts/check-leak.mjs [--worktree | --history]');
  process.exit(unknown.length ? 2 : 0);
}

function git(gitArgs, opts = {}) {
  return execFileSync('git', gitArgs, {
    cwd: ROOT,
    encoding: opts.encoding === undefined ? 'utf8' : opts.encoding,
    input: opts.input,
    maxBuffer: opts.maxBuffer ?? 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ============================== 脱敏 ============================== */

function maskGeneric(s) {
  return s.length <= 4 ? '***' : `${s.slice(0, 2)}***`;
}

function maskEmail() {
  return '***@***';
}

function maskIp(s) {
  return s.replace(/\d+/g, '***');
}

function maskWorkers() {
  return '***.workers.dev';
}

function maskPath(s) {
  const prefix = s.match(/^.*?(?:\/Users\/|\/home\/|\/root\/|[A-Za-z]:\\Users\\)/)?.[0] ?? '';
  return `${prefix}***`;
}

/* ============================== 规则 ============================== */

const ALLOWED_EMAIL_DOMAINS = new Set([
  'example.com',
  'example.org',
  'example.net',
  'example.invalid',
  'test.com',
  'test.local',
  'localhost',
  'users.noreply.github.com',
  'noreply.github.com',
]);

const ALLOWED_WORKERS_LABELS = new Set([
  'example',
  'internal',
  'test',
  'demo',
  'placeholder',
  'your-subdomain',
  'your-account',
  'your-name',
  'my-worker',
  'worker',
]);

const ALLOWED_LOCAL_USERS = new Set([
  'user',
  'username',
  'yourname',
  'you',
  'example',
  'name',
  'root',
  'runner',
  'node',
  'ubuntu',
  'vscode',
  'codespace',
  'circleci',
  'travis',
  'jenkins',
]);

const PLACEHOLDER_UUIDS = new Set([
  '00000000-0000-0000-0000-000000000000',
  '123e4567-e89b-12d3-a456-426614174000',
]);

function looksLikePlaceholder(value) {
  const v = value.trim();
  if (!v) return true;
  if (v.includes('${') || v.includes('{{') || v.includes('<') || v.includes('>')) return true;
  if (/(?:example|placeholder|change[_-]?me|dummy|fake|sample|redacted|your[_-]|todo|localhost|127\.0\.0\.1)/i.test(v)) return true;
  if (/^(.)\1+$/.test(v)) return true;
  if (new Set(v).size < 6) return true;
  if (/^eyJ/.test(v)) return true;
  if (/^(?:0123456789abcdef|abcdef0123456789|1234567890abcdef|deadbeef)+$/i.test(v)) return true;
  return false;
}

function isAllowedEmail(s) {
  const cleaned = s.replace(/^[^\w]+|[^\w]+$/g, '');
  const at = cleaned.lastIndexOf('@');
  if (at < 0) return true;
  const local = cleaned.slice(0, at);
  const domain = cleaned.slice(at + 1).toLowerCase();
  if (ALLOWED_EMAIL_DOMAINS.has(domain)) return true;
  if (domain.endsWith('.example') || domain.endsWith('.invalid') || domain.endsWith('.localhost')) return true;
  if (domain === 'github.com' && local.toLowerCase() === 'noreply') return true;
  // a@b.co / x@y.z 这类单字符占位邮箱
  if (local.length <= 1 && domain.split('.')[0].length <= 1) return true;
  return false;
}

function isPublicIp(s) {
  const parts = s.split('.');
  if (parts.length !== 4) return false;
  if (parts.some((p) => p.length > 1 && p.startsWith('0'))) return false;
  const o = parts.map(Number);
  if (o.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (o[0] === 0 || o[0] === 10 || o[0] === 127) return false;
  if (o[0] === 172 && o[1] >= 16 && o[1] <= 31) return false;
  if (o[0] === 192 && o[1] === 168) return false;
  if (o[0] === 169 && o[1] === 254) return false;
  if (o[0] === 100 && o[1] >= 64 && o[1] <= 127) return false;
  if (o[0] === 192 && o[1] === 0 && o[2] === 2) return false;
  if (o[0] === 198 && (o[1] === 18 || o[1] === 19 || (o[1] === 51 && o[2] === 100))) return false;
  if (o[0] === 203 && o[1] === 0 && o[2] === 113) return false;
  if (o[0] >= 224) return false;
  return true;
}

function isPlaceholderPhone(s) {
  const tail = s.slice(3);
  if (/^(\d)\1+$/.test(tail)) return true;
  if (s === '13800138000') return true;
  if (/0123456789|9876543210/.test(s)) return true;
  return false;
}

function isAllowedLocalPath(s) {
  const rest = s.replace(/^.*?(?:\/Users\/|\/home\/|\/root\/|[A-Za-z]:\\Users\\)/, '');
  const user = rest.split(/[\\/]/)[0].toLowerCase();
  return !user || ALLOWED_LOCAL_USERS.has(user);
}

function isPlaceholderUuid(s) {
  return PLACEHOLDER_UUIDS.has(s.toLowerCase()) || /^([0-9a-f])\1{7}-/.test(s.toLowerCase());
}

const RULES = [];

/* 私有规则放最前：同一位置优先按私有规则报告，且不输出任何片段。 */
let privateRuleCount = 0;
if (existsSync(PRIVATE_RULES)) {
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(PRIVATE_RULES, 'utf8'));
  } catch (e) {
    console.error(`✗ ${PRIVATE_RULES_LABEL} 解析失败：${e.message}`);
    process.exit(2);
  }
  const literals = Array.isArray(cfg.leakLiterals) ? cfg.leakLiterals : [];
  for (const literal of literals) {
    if (typeof literal !== 'string' || literal.length < 3) continue;
    privateRuleCount++;
    RULES.push({
      name: `私有规则 #${privateRuleCount}`,
      re: new RegExp(escapeRe(literal), 'gi'),
      mask: () => '[已隐藏]',
    });
  }
}

RULES.push(
  { name: '闭源版表名', re: /\bzz_[a-z][a-z0-9_]*\b/g, mask: () => 'zz_***' },
  { name: '个人收款码', re: /\bwxp:\/\/[A-Za-z0-9_-]{20,}/g, mask: () => '[已隐藏]' },
  { name: '个人收款码', re: /\bhttps?:\/\/qr\.alipay\.com\/[A-Za-z0-9]{10,}/g, mask: () => '[已隐藏]' },
  { name: '私钥文件头', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g, mask: () => '[已隐藏]' },
  { name: 'AWS 访问密钥', re: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, mask: () => '[已隐藏]' },
  { name: 'GitHub Token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b/g, mask: () => '[已隐藏]' },
  { name: 'Slack Token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, mask: () => '[已隐藏]' },
  { name: 'Google API Key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g, mask: () => '[已隐藏]' },
  { name: 'Stripe 密钥', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g, mask: () => '[已隐藏]' },
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, mask: () => '[已隐藏]' },
  {
    name: 'Cloudflare API Token',
    re: /\b(?:CF_API_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_KEY|CLOUDFLARE_API_KEY)\b[^\n]{0,40}?['"]([A-Za-z0-9_-]{32,})['"]/g,
    mask: () => '[已隐藏]',
  },
  {
    name: 'Cloudflare Account ID',
    re: /[A-Za-z0-9_]*account[_-]?id[^\n]{0,40}?['"]([a-fA-F0-9]{32})['"]/gi,
    mask: () => '[已隐藏]',
  },
  {
    name: 'D1 数据库 ID',
    re: /[A-Za-z0-9_]*(?:database[_-]?id|d1[_-]?id)[^\n]{0,40}?['"]([0-9a-fA-F-]{36})['"]/gi,
    mask: () => '[已隐藏]',
  },
  {
    name: '疑似密钥字面量',
    re: /(?:epaykey_ali|admin_secret|cron_key|merchant_key|app_key)[^\n]{0,20}?['"]([a-f0-9]{32})['"]/g,
    mask: () => '[已隐藏]',
  },
  {
    name: '密钥赋值',
    re: /\b(?:[A-Za-z0-9_]*(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|private[_-]?key|access[_-]?key|auth[_-]?key)[A-Za-z0-9_]*)\b\s*[:=]\s*['"]([^'"\n]{16,})['"]/gi,
    mask: () => '[已隐藏]',
    filter: (m) => !looksLikePlaceholder(m[1]),
  },
  {
    name: 'UUID',
    re: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    mask: () => '***',
    filter: (m) => !isPlaceholderUuid(m[0]),
  },
  {
    name: '邮箱地址',
    re: /[A-Za-z0-9][A-Za-z0-9.!#$%&*+/^_`{|}~-]*@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}/g,
    mask: maskEmail,
    filter: (m) => !isAllowedEmail(m[0]),
  },
  {
    name: '公网 IP',
    re: /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?!\d|\.\d)/g,
    mask: maskIp,
    filter: (m) => isPublicIp(m[0]),
  },
  {
    name: '手机号',
    re: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
    mask: () => '1**********',
    filter: (m) => !isPlaceholderPhone(m[0]),
  },
  {
    name: 'workers.dev 子域',
    re: /\b([a-zA-Z0-9][a-zA-Z0-9-]*)\.workers\.dev\b/g,
    mask: maskWorkers,
    filter: (m) => !ALLOWED_WORKERS_LABELS.has(m[1].toLowerCase()),
  },
  {
    name: '本机绝对路径',
    re: /(?:\/Users\/|\/home\/|\/root\/|[A-Za-z]:\\Users\\)([^\s"'`<>)]+)/g,
    mask: maskPath,
    filter: (m) => !isAllowedLocalPath(m[0]),
  },
);

/* ============================== 扫描 ============================== */

const hits = [];
const seen = new Set();
const stats = {
  worktreeFiles: 0,
  worktreeSkipped: 0,
  historyBlobs: 0,
  historySkipped: 0,
  commits: 0,
  tags: 0,
};

function lineAt(text, index) {
  const start = text.lastIndexOf('\n', index - 1) + 1;
  const end = text.indexOf('\n', index);
  return text.slice(start, end === -1 ? text.length : end);
}

function countLines(text, index) {
  let n = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) n++;
  return n;
}

function scan(text, source) {
  if (!text) return;
  for (const rule of RULES) {
    const re = rule.re;
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      if (!m[0]) {
        re.lastIndex++;
        continue;
      }
      if (!source.metadata && /check-leak-ignore/i.test(lineAt(text, m.index))) continue;
      if (rule.filter && !rule.filter(m, text)) continue;

      const line = source.metadata ? null : countLines(text, m.index);
      const key = `${source.kind}\0${source.ref}\0${line}\0${m.index}`;
      if (seen.has(key)) continue;
      seen.add(key);

      hits.push({
        source,
        line,
        rule: rule.name,
        sample: rule.mask ? rule.mask(m[0], m) : maskGeneric(m[0]),
      });
      if (hits.length >= MAX_HITS) {
        console.error(`✗ 命中数达到 ${MAX_HITS}，已停止扫描（请先处理已列出的问题）`);
        throw new Error('CHECK_LEAK_LIMIT');
      }
    }
  }
}

function scanWorktree() {
  const out = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']);
  const files = [...new Set(out.split('\0').filter(Boolean))];
  for (const rel of files) {
    const abs = `${ROOT}/${rel}`;
    let st;
    try {
      st = statSync(abs);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    if (st.size > MAX_BYTES) {
      stats.worktreeSkipped++;
      continue;
    }
    const buf = readFileSync(abs);
    if (buf.includes(0)) {
      stats.worktreeSkipped++;
      continue;
    }
    stats.worktreeFiles++;
    scan(buf.toString('utf8'), { kind: '工作区', ref: rel });
  }
}

function historyObjects() {
  const out = git(['-c', 'core.quotePath=false', 'rev-list', '--objects', '--all']);
  const oidPath = new Map();
  for (const line of out.split('\n')) {
    const sp = line.indexOf(' ');
    if (sp < 0) continue;
    const oid = line.slice(0, sp);
    if (!oidPath.has(oid)) oidPath.set(oid, line.slice(sp + 1));
  }
  return oidPath;
}

function scanHistory() {
  const oidPath = historyObjects();
  const oids = [...oidPath.keys()];
  if (!oids.length) return;

  const check = git(['cat-file', '--batch-check=%(objectname) %(objecttype) %(objectsize)'], {
    input: `${oids.join('\n')}\n`,
  });
  const blobs = [];
  for (const line of check.split('\n')) {
    if (!line) continue;
    const [oid, type, sizeStr] = line.split(' ');
    const size = Number(sizeStr);
    if (type !== 'blob') continue;
    if (!Number.isFinite(size) || size > MAX_BYTES) {
      stats.historySkipped++;
      continue;
    }
    blobs.push({ oid, size });
  }
  if (!blobs.length) return;

  const batch = git(['cat-file', '--batch'], {
    encoding: null,
    input: `${blobs.map((b) => b.oid).join('\n')}\n`,
    maxBuffer: 512 * 1024 * 1024,
  });

  let pos = 0;
  for (const blob of blobs) {
    const nl = batch.indexOf(0x0a, pos);
    if (nl < 0) break;
    const header = batch.subarray(pos, nl).toString('utf8');
    const [oid, type, sizeStr] = header.split(' ');
    const size = Number(sizeStr);
    if (type !== 'blob' || !Number.isFinite(size)) break;
    const start = nl + 1;
    const end = start + size;
    const content = batch.subarray(start, end);
    pos = end + 1;

    if (content.includes(0)) {
      stats.historySkipped++;
      continue;
    }
    stats.historyBlobs++;
    scan(content.toString('utf8'), {
      kind: '历史',
      ref: `${oidPath.get(oid) || '(无路径)'} (blob ${oid.slice(0, 8)})`,
    });
  }
}

function scanCommits() {
  const shas = git(['rev-list', '--all']).trim().split('\n').filter(Boolean);
  stats.commits = shas.length;
  for (const sha of shas) {
    const raw = git(['cat-file', 'commit', sha], { maxBuffer: 16 * 1024 * 1024 });
    const sep = raw.indexOf('\n\n');
    const header = sep >= 0 ? raw.slice(0, sep) : raw;
    const message = sep >= 0 ? raw.slice(sep + 2) : '';

    scan(message, { kind: '提交说明', ref: sha.slice(0, 7) });

    for (const line of header.split('\n')) {
      const m = /^(author|committer) (.+) <([^>]*)>(?: \d+ [+-]\d+)?$/.exec(line);
      if (!m) continue;
      scan(`${m[2]} <${m[3]}>`, {
        kind: '提交元数据',
        ref: `${sha.slice(0, 7)} (${m[1]})`,
        metadata: true,
      });
    }
  }
}

function scanTags() {
  const out = git(['for-each-ref', '--format=%(objectname) %(objecttype) %(refname)', 'refs/tags']);
  for (const line of out.split('\n')) {
    const [oid, type, ref] = line.split(' ');
    if (!oid || type !== 'tag') continue;
    stats.tags++;
    const raw = git(['cat-file', 'tag', oid], { maxBuffer: 16 * 1024 * 1024 });
    const sep = raw.indexOf('\n\n');
    if (sep < 0) continue;
    scan(raw.slice(sep + 2), { kind: '标签说明', ref });
  }
}

/* ============================== 主流程 ============================== */

const started = Date.now();
try {
  if (!onlyHistory) scanWorktree();
  if (!onlyWorktree) {
    scanHistory();
    scanCommits();
    scanTags();
  }
} catch (e) {
  if (e.message !== 'CHECK_LEAK_LIMIT') throw e;
}

const elapsed = ((Date.now() - started) / 1000).toFixed(1);

if (hits.length === 0) {
  if (!onlyHistory) {
    const skipped = stats.worktreeSkipped ? `，跳过 ${stats.worktreeSkipped} 个二进制/超大文件` : '';
    console.log(`✓ 工作区：扫描 ${stats.worktreeFiles} 个可发布文件${skipped}`);
  }
  if (!onlyWorktree) {
    const skipped = stats.historySkipped ? `，跳过 ${stats.historySkipped} 个二进制/超大 blob` : '';
    const tags = stats.tags ? `、${stats.tags} 个标签说明` : '';
    console.log(`✓ 历史：扫描 ${stats.commits} 个提交、${stats.historyBlobs} 个文本 blob${tags}${skipped}`);
  }
  if (privateRuleCount) console.log(`✓ 私有规则：已加载 ${privateRuleCount} 条（真实值不会出现在输出中）`);
  console.log(`✓ 未发现疑似泄露（耗时 ${elapsed}s）`);
  process.exit(0);
}

console.error(`✗ 发现 ${hits.length} 处疑似泄露（值已脱敏）：\n`);
for (const h of hits) {
  const location = h.line === null ? `${h.source.kind} ${h.source.ref}` : `${h.source.kind} ${h.source.ref}:${h.line}`;
  console.error(`  ${location}  [${h.rule}]  ${h.sample}`);
}
console.error('\n真实值请放 wrangler.local.jsonc / seed.local.sql / .private-rules.json（均已在 .gitignore 中）。');
console.error('确认是测试假值时，可在同一行加 `check-leak-ignore` 注释后重跑。');
process.exit(1);
