/**
 * 首次初始化向导（替代 PHP 版的 install 目录）。
 *
 * 设计约束：
 *   1. **只在没有任何管理员时可用** —— 线上已有管理员，访问 /setup 直接 404，
 *      所以这个文件对已运行的实例完全透明。
 *   2. 初始化完成后永久关闭（管理员存在即不可用），不存在"重置"入口。
 *   3. 通讯密钥 / admin_secret / cron_key 全部**随机生成**，不用文档里的默认值
 *      —— 参考项目把 admin123 写进 README，那是最大的安全隐患。
 *   4. 可选 `SETUP_TOKEN`：配了就要求 URL 带同样的 token，防别人抢先初始化。
 *
 * 前置条件：已经执行过 `wrangler d1 execute <db> --file=schema.sql --remote`（表存在）。
 */
import type { Env } from '../lib/db';
import { setAdminAliasCache } from '../lib/db';
import { hashPassword } from '../lib/auth';
import { html, randHex, text } from '../lib/util';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const STYLE = `
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
         background:#f5f6f8;font:14px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;color:#1f2329;padding:24px}
    .card{width:100%;max-width:520px;background:#fff;border-radius:14px;padding:32px 32px 26px;
          box-shadow:0 1px 2px rgba(16,24,40,.04),0 12px 32px -12px rgba(16,24,40,.16)}
    h1{margin:0 0 6px;font-size:19px;font-weight:500}
    .sub{margin:0 0 22px;color:#6b7280;font-size:13px}
    label{display:block;margin:14px 0 6px;font-size:13px;color:#374151}
    input{width:100%;height:38px;padding:0 12px;border:1px solid #d8dbe0;border-radius:8px;font-size:14px;outline:none}
    input:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.12)}
    .hint{margin-top:5px;font-size:12px;color:#9aa1ac}
    button{width:100%;height:40px;margin-top:22px;border:0;border-radius:8px;background:#2563eb;color:#fff;font-size:14px;cursor:pointer}
    button:hover{background:#1d4ed8}
    .err{margin:0 0 16px;padding:10px 12px;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:13px}
    .ok{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 18px;margin-top:6px}
    .ok b{font-weight:500}
    code{background:#f3f4f6;padding:2px 6px;border-radius:5px;font-size:13px;word-break:break-all}
    a{color:#2563eb;text-decoration:none}
`;

function page(title: string, body: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body><div class="card">${body}</div></body></html>`;
}

function formPage(token: string, err = '', v: Record<string, string> = {}): string {
  const val = (k: string, d = '') => esc(v[k] ?? d);
  return page(
    '初始化 · V免签',
    `<h1>初始化 V免签</h1>
    <p class="sub">第一次运行需要创建管理员并生成密钥。完成后本页面会永久关闭。</p>
    ${err ? `<p class="err">${esc(err)}</p>` : ''}
    <form method="post" action="/setup">
      ${token ? `<input type="hidden" name="token" value="${esc(token)}">` : ''}
      <label>管理员账号</label>
      <input name="username" value="${val('username', 'admin')}" autocomplete="username" required>
      <div class="hint">3–20 位，字母数字下划线</div>

      <label>登录密码</label>
      <input name="password" type="password" autocomplete="new-password" required>
      <div class="hint">至少 8 位</div>

      <label>确认密码</label>
      <input name="password2" type="password" autocomplete="new-password" required>

      <label>后台入口别名</label>
      <input name="alias" value="${val('alias', 'admin')}" required>
      <div class="hint">后台会挂在 <code>/{别名}</code>。建议别用 admin，改成只有你知道的字符串（之后可在 config 表调整）</div>

      <label>站点名称</label>
      <input name="sitename" value="${val('sitename', 'V免签')}" required>

      <button type="submit">完成初始化</button>
    </form>`
  );
}

function donePage(alias: string, key: string): string {
  return page(
    '初始化完成',
    `<h1>初始化完成</h1>
    <p class="sub">以下信息只显示这一次，请截图或保存。</p>
    <div class="ok">
      <p style="margin:0 0 8px"><b>后台地址</b><br><code>/${esc(alias)}/login</code></p>
      <p style="margin:0"><b>通讯密钥</b>（监控端 App 绑定用）<br><code>${esc(key)}</code></p>
    </div>
    <p class="hint" style="margin-top:16px">通讯密钥之后也能在后台「系统设置」里查看。请先登录并修改密码。</p>
    <p style="margin-top:18px"><a href="/${esc(alias)}/login">前往登录 →</a></p>`
  );
}

/** 表还没建：「先跑 schema.sql」比 500 堆栈友好得多 */
function notReadyPage(): string {
  return page(
    '数据库未初始化',
    `<h1>数据库还没建表</h1>
     <p class="sub">先执行下面这条命令，再刷新本页：</p>
     <p><code>wrangler d1 execute vmq --file=./schema.sql --remote</code></p>
     <p class="hint">不加 <code>--remote</code> 只建本地模拟库，线上仍然是空的。</p>`
  );
}

async function countAdmins(env: Env): Promise<number | null> {
  try {
    const r = await env.DB.prepare('SELECT COUNT(*) AS c FROM admins').first<{ c: number }>();
    return Number(r?.c ?? 0);
  } catch {
    return null; // 表不存在
  }
}

export async function handleSetup(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const token = env.SETUP_TOKEN ?? '';

  const count = await countAdmins(env);
  if (count === null) return html(notReadyPage(), 503);
  // 已初始化（线上走这里）→ 一律 404，不暴露任何信息
  if (count > 0) return text('Not Found', 404);

  // 配了 SETUP_TOKEN 就必须带对，否则当作不存在。
  // 令牌有两个来源：查询串（首次访问 `/setup?token=…`）与表单隐藏域（提交时）。
  // 表单的 action 是 `/setup`，提交时**查询串会丢掉**，只剩 body 里的 token，
  // 所以这里必须同时认 body —— 否则 POST 一律 404，表现就是「填完点提交没有反应」。
  let provided = url.searchParams.get('token') ?? '';
  if (!provided && req.method === 'POST') {
    try {
      // clone 一份来读，避免把原始 body 消耗掉
      provided = String((await req.clone().formData()).get('token') ?? '');
    } catch {
      /* 解析失败留空，下面按未授权处理 */
    }
  }
  if (token && provided !== token) return text('Not Found', 404);

  if (req.method === 'GET') return html(formPage(url.searchParams.get('token') ?? token));

  if (req.method !== 'POST') return text('Method Not Allowed', 405);

  let f: FormData;
  try {
    f = await req.formData();
  } catch {
    return html(formPage(token, '表单解析失败，请重试'));
  }
  const g = (k: string) => String(f.get(k) ?? '').trim();
  const username = g('username');
  const password = g('password');
  const password2 = g('password2');
  const alias = g('alias') || 'admin';
  const sitename = g('sitename') || 'V免签';

  const back = { username, alias, sitename };
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return html(formPage(token, '账号需 3–20 位字母数字下划线', back));
  if (password.length < 8) return html(formPage(token, '密码至少 8 位', back));
  if (password !== password2) return html(formPage(token, '两次输入的密码不一致', back));
  if (!/^[a-zA-Z0-9_-]{2,32}$/.test(alias)) return html(formPage(token, '别名 2–32 位，仅字母数字、下划线、短横线', back));
  if (sitename.length > 30) return html(formPage(token, '站点名称不超过 30 字', back));

  // 并发保护：再查一次，避免两个人同时提交建出两个管理员
  const recheck = await countAdmins(env);
  if ((recheck ?? 0) > 0) return text('Not Found', 404);

  // 已经有值的密钥不重新生成 —— 忘记密码时走"清空 admins 表 → 重新 /setup"这条路，
  // 通讯密钥必须保持不变，否则监控端要重新绑定、历史订单的验签也会对不上。
  const existing = await env.DB.prepare(
    "SELECT k, v FROM config WHERE k IN ('key','admin_secret','cron_key')"
  ).all<{ k: string; v: string }>();
  const have = new Map((existing.results ?? []).map((r) => [r.k, r.v || '']));

  const commKey = have.get('key') || randHex(16); // 通讯密钥（appPush 验签）
  const adminSecret = have.get('admin_secret') || randHex(16); // 会话/验证码签名
  const cronKey = have.get('cron_key') || randHex(16); // 兼容旧版的"监控密钥"字段
  const pwHash = await hashPassword(password);
  const ts = Math.floor(Date.now() / 1000);

  const cfg: [string, string][] = [
    ['setup_done', '1'],
    ['admin_alias', alias],
    ['key', commKey],
    ['admin_secret', adminSecret],
    ['cron_key', cronKey],
    ['title', sitename],
  ];

  try {
    await env.DB.batch([
      env.DB.prepare(
        'INSERT INTO admins (username, password_hash, status, role, created_at) VALUES (?, ?, 1, 1, ?)'
      ).bind(username, pwHash, ts),
      ...cfg.map(([k, v]) =>
        env.DB.prepare('INSERT INTO config (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, v)
      ),
    ]);
  } catch (e) {
    return html(formPage(token, `写入失败：${String(e).slice(0, 160)}`, back));
  }

  setAdminAliasCache(alias);
  return html(donePage(alias, commKey));
}
