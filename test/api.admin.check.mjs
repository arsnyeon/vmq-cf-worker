/**
 * /api/admin/* 接口回归。
 *
 * 前提：本地 dev server 已启动（pnpm dev），库已初始化。
 * 用法：node test/api.admin.check.mjs [baseUrl]
 *
 * 与 smoke.full.mjs 的分工：smoke 盯旧后台的 HTML 页面与表单链路，
 * 这里盯新 SPA 要用的纯 JSON 接口（含 401、字段形状、CRUD 往返）。
 */
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const BASE = process.argv[2] ?? 'http://localhost:8787';
const API = `${BASE}/api/admin`;

let pass = 0;
let fail = 0;
const fails = [];

function check(name, ok, detail = '') {
  if (ok) {
    pass++;
    console.log(`✓ ${name}${detail ? '  ' + detail : ''}`);
  } else {
    fail++;
    fails.push(name);
    console.log(`✗ ${name}${detail ? '  ' + detail : ''}`);
  }
}

const DB = execFileSync("find .wrangler/state/v3/d1 -name '*.sqlite' ! -name 'metadata*'", {
  encoding: 'utf8',
  shell: '/bin/sh',
})
  .trim()
  .split('\n')[0];
if (!DB) {
  console.log('找不到本地 D1 文件，先执行 pnpm db:local');
  process.exit(1);
}

/* ---------- 临时关掉图形验证码，跑完恢复 ---------- */
const capOriginal =
  execFileSync('sqlite3', [DB], {
    input: `SELECT v FROM config WHERE k='admin_captcha';`,
    encoding: 'utf8',
  }).trim() || '1';
execFileSync('sqlite3', [DB], {
  input: `UPDATE config SET v='0' WHERE k='admin_captcha';
          INSERT INTO config (k, v) VALUES ('admin_captcha', '0')
            ON CONFLICT(k) DO UPDATE SET v='0';`,
});

/* ---------- 建一个临时管理员 ---------- */
const PW = randomBytes(12).toString('hex');
const USER = 'api_check_admin';
const b64u = (b) =>
  Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const salt = randomBytes(16);
const hash = `pbkdf2$60000$${b64u(salt)}$${b64u(pbkdf2Sync(PW, salt, 60000, 32, 'sha256'))}`;
execFileSync('sqlite3', [DB], {
  input:
    `INSERT INTO admins (username, password_hash, status, role, created_at) ` +
    `VALUES ('${USER}', '${hash}', 1, 1, 0) ` +
    `ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash, status=1;`,
});

/* ---------- 请求辅助 ---------- */
let cookie = '';

async function call(method, path, body, opts = {}) {
  const headers = {};
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (cookie && opts.auth !== false) headers.cookie = cookie;
  const r = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await r.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON（比如验证码 SVG） */
  }
  return { status: r.status, json, text, headers: r.headers };
}

const pending = [];
function cleanup(fn) {
  pending.push(fn);
}

try {
  console.log('\n=== 鉴权 ===');
  const noAuth = await call('GET', '/me', undefined, { auth: false });
  check('未登录返回 401', noAuth.status === 401, `${noAuth.status} ${noAuth.json?.msg ?? ''}`);

  const login = await call('POST', '/login', { username: USER, password: PW }, { auth: false });
  check('登录成功', login.json?.code === 1, login.json?.msg ?? '');
  cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
  check('拿到会话 cookie', cookie.startsWith('vmq_admin='));

  const me = await call('GET', '/me');
  check('/me 返回当前用户', me.json?.code === 1 && me.json?.data?.username === USER, me.json?.data?.username);

  console.log('\n=== 只读接口 ===');
  const stats = await call('GET', '/stats');
  check('/stats 看板', stats.json?.code === 1 && !!stats.json?.data?.chartData, '');
  check('/stats 曲线 7 个点', stats.json?.data?.chartData?.income1?.length === 7);

  for (const [path, name] of [
    ['/orders?page=1&limit=2', '订单'],
    ['/passages?page=1&limit=2', '通道'],
    ['/qrcodes?page=1&limit=2', '固定金额码'],
    ['/logs?page=1&limit=2', '日志'],
    ['/admins?page=1&limit=2', '管理员'],
  ]) {
    const r = await call('GET', path);
    check(
      `${name}列表`,
      r.json?.code === 0 && Array.isArray(r.json?.data) && typeof r.json?.count === 'number',
      `count=${r.json?.count}`
    );
  }

  const opts = await call('GET', '/passages/options');
  check('通道下拉', opts.json?.code === 1 && Array.isArray(opts.json?.data));

  console.log('\n=== 配置（密钥不回传） ===');
  const cfg = await call('GET', '/config');
  const cfgData = cfg.json?.data?.config ?? {};
  check('/config 返回配置对象', cfg.json?.code === 1 && typeof cfgData === 'object');
  check('密钥未出现在 config 里', cfgData.key === undefined && cfgData.epaykey_ali === undefined);
  check('密钥用 secretSet 标记', typeof cfg.json?.data?.secretSet === 'object');

  // app_key 与 key 等价（db.ts 的 appSecret 优先读它），必须同样过滤掉。
  // PUT /config 不接受这个键（不在 CONFIG_KEYS 里），所以直接写库模拟真实配置。
  console.log('\n=== app_key 不回传（回归） ===');
  const dbPath = execFileSync("find .wrangler/state/v3/d1 -name '*.sqlite' ! -name 'metadata*'", {
    encoding: 'utf8',
    shell: '/bin/sh',
  })
    .trim()
    .split('\n')[0];
  const sqlRun = (q) => execFileSync('sqlite3', [dbPath], { input: q, encoding: 'utf8' });
  const SENTINEL = `SECRET_${Math.random().toString(36).slice(2, 10)}`;
  let sentinelSet = false;
  try {
    sqlRun(
      `INSERT INTO config (k,v) VALUES ('app_key','${SENTINEL}') ON CONFLICT(k) DO UPDATE SET v=excluded.v;`
    );
    sentinelSet = true;
  } catch (e) {
    console.log(`（写库失败，跳过这组断言：${e.message}）`);
  }
  if (sentinelSet) {
    cleanup(() => sqlRun(`DELETE FROM config WHERE k='app_key';`));
    const withKey = await call('GET', '/config');
    const body = JSON.stringify(withKey.json ?? {});
    check('app_key 原值不回传', !body.includes(SENTINEL), body.includes(SENTINEL) ? '泄露！' : '已过滤');
    check('secretSet 标记 app_key 已配置', withKey.json?.data?.secretSet?.app_key === true);
    sqlRun(`DELETE FROM config WHERE k='app_key';`);
    const afterClean = await call('GET', '/config');
    check('清理后不再标记 app_key', afterClean.json?.data?.secretSet?.app_key === false);
  }

  // 公告功能已移除，CRUD 往返改用管理员这个同形状的域
  console.log('\n=== CRUD 往返（管理员） ===');
  const uniq = Math.random().toString(36).slice(2, 8);
  const uname = `crud_${uniq}`;
  const created = await call('POST', '/admins', {
    username: uname, password: 'Passw0rd!', repassword: 'Passw0rd!', role: 2, status: 1,
  });
  check('新增', created.json?.code === 1, created.json?.msg ?? '');
  const listAfter = await call('GET', '/admins?page=1&limit=50');
  const row = (listAfter.json?.data ?? []).find((x) => x.username === uname);
  check('新增后能查到', !!row, row ? `id=${row.id}` : '');

  if (row) {
    cleanup(async () => {
      await call('DELETE', `/admins?id=${row.id}`);
    });
    const edited = await call('PUT', `/admins/${row.id}`, {
      username: uname, role: 2, status: 1, phone: '13800000000',
    });
    check('修改', edited.json?.code === 1, edited.json?.msg ?? '');
    const off = await call('PATCH', `/admins/${row.id}/status`, { status: 0 });
    check('启停', off.json?.code === 1, off.json?.msg ?? '');
    const del = await call('DELETE', `/admins?id=${row.id}`);
    check('删除', del.json?.code === 1, del.json?.msg ?? '');
  }

  console.log('\n=== 批量删除：DELETE + JSON body ===');
  // SPA 的批量删除走 DELETE + { ids: [1,2] }，与旧后台的 ?id=1,2 不同。
  // 之前 readParams 只在 POST 时解析 body，导致这条路径静默失败（报「缺少 id」）。
  const batchNames = [`batch_a_${uniq}`, `batch_b_${uniq}`];
  const batch = [];
  for (const t of batchNames) {
    const c = await call('POST', '/admins', {
      username: t, password: 'Passw0rd!', repassword: 'Passw0rd!', role: 2, status: 1,
    });
    if (c.json?.code === 1) batch.push(t);
  }
  cleanup(async () => {
    for (const t of batch) {
      const l = await call('GET', '/admins?page=1&limit=50');
      const r = (l.json?.data ?? []).find((x) => x.username === t);
      if (r) await call('DELETE', `/admins?id=${r.id}`);
    }
  });
  check('准备两条测试管理员', batch.length === 2, batch.join('、'));

  const before = await call('GET', '/admins?page=1&limit=50');
  const ids = (before.json?.data ?? []).filter((x) => batch.includes(x.username)).map((x) => x.id);
  check('查到两条待删记录', ids.length === 2, ids.join(','));

  if (ids.length === 2) {
    const delBody = await call('DELETE', '/admins', { ids });
    check('DELETE + JSON body 成功', delBody.json?.code === 1, delBody.json?.msg ?? '');
    const after = await call('GET', '/admins?page=1&limit=50');
    const left = (after.json?.data ?? []).filter((x) => ids.includes(x.id));
    check('两条都被删掉', left.length === 0, `剩余 ${left.length}`);
  }

  console.log('\n=== 写入校验（通道） ===');
  const badPassage = await call('POST', '/passages', { type: 1 });
  check('缺收款码被拒', badPassage.json?.code === 0, badPassage.json?.msg ?? '');
  const newPassage = await call('POST', '/passages', {
    type: 1,
    code: 0,
    ewm: 'wxp://API_TEST',
    zf_pid: '2088APITEST',
    remarks: 'API_TEST_MARK',
  });
  check('新增通道', newPassage.json?.code === 1, newPassage.json?.msg ?? '');
  const passages = await call('GET', '/passages?page=1&limit=50');
  const pr = (passages.json?.data ?? []).find((x) => x.remarks === 'API_TEST_MARK');
  if (pr) {
    cleanup(async () => {
      await call('DELETE', `/passages?id=${pr.id}`);
    });
    check('通道 old_type 保留数字', typeof pr.old_type === 'number', String(pr.old_type));
    // 对齐旧版表单后新增的「支付用户ID」，保存后要能原样读回
    check('支付用户ID 往返', pr.zf_pid === '2088APITEST', String(pr.zf_pid));
    // 列表筛选（对齐旧后台搜索行的字段）
    const flt1 = await call('GET', '/passages?page=1&limit=50&remarks=API_TEST_MARK');
    check('按备注筛选', flt1.json?.code === 0 && flt1.json?.count === 1, `count=${flt1.json?.count}`);
    const flt2 = await call('GET', `/passages?page=1&limit=50&status=1&type=${pr.old_type}`);
    check('按状态+支付模式筛选', flt2.json?.code === 0, `count=${flt2.json?.count}`);
    const flt3 = await call('GET', '/passages?page=1&limit=50&start=2099-01-01&end=2099-12-31');
    check('按时间范围筛选（未来=0 条）', flt3.json?.code === 0 && flt3.json?.count === 0, `count=${flt3.json?.count}`);
    check('行带 APP 配置', typeof pr.app_config === 'string', pr.app_config ? '已生成' : '空（未配密钥）');

    // 列表筛选（对齐旧后台搜索行的字段）

    const st = await call('PATCH', `/passages/${pr.id}/status`, { status: 0 });
    check('通道启停', st.json?.code === 1, st.json?.msg ?? '');
    const delP = await call('DELETE', `/passages?id=${pr.id}`);
    check('通道删除', delP.json?.code === 1, delP.json?.msg ?? '');
  }

  console.log('\n=== 边界 ===');
  const unknown = await call('GET', '/nope');
  check('未知接口 404', unknown.status === 404);
  const badPage = await call('GET', '/orders?page=abc&limit=999');
  check('非法分页参数不报错', badPage.json?.code === 0, `count=${badPage.json?.count}`);

  console.log('\n=== 系统信息 / 上传 / 个人资料 ===');
  const info = await call('GET', '/system-info');
  check('/system-info', info.json?.code === 1 && !!info.json?.data?.edition, info.json?.data?.edition);
  check('含监控端状态', typeof info.json?.data?.monitor === 'string', info.json?.data?.monitor);
  check('含回调判定', typeof info.json?.data?.notifyJudge === 'string');

  // 1x1 PNG
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  );
  const fd = new FormData();
  fd.append('file', new Blob([png], { type: 'image/png' }), 'x.png');
  const up = await fetch(`${API}/upload`, { method: 'POST', headers: { cookie }, body: fd });
  const upJson = await up.json();
  check('上传图片', upJson.code === 1 && !!upJson.data?.url, upJson.data?.url ?? upJson.msg);
  if (upJson.data?.url) {
    const got = await fetch(BASE + upJson.data.url);
    check('上传后可访问', got.status === 200, `HTTP ${got.status}`);
  }
  const badType = new FormData();
  badType.append('file', new Blob([Buffer.from('hello')], { type: 'text/plain' }), 'x.txt');
  const bad = await fetch(`${API}/upload`, { method: 'POST', headers: { cookie }, body: badType });
  check('非图片被拒', (await bad.json()).code === 0);

  const prof = await call('GET', '/profile');
  check('/profile 读取', prof.json?.code === 1 && prof.json?.data?.username === USER);
  const profSave = await call('PUT', '/profile', { phone: '13800000000', email: 'a@b.co', head_img: '' });
  check('/profile 保存', profSave.json?.code === 1, profSave.json?.msg ?? '');
  const weakPw = await call('PUT', '/profile/password', { password: '123', password_again: '123' });
  check('弱密码被拒', weakPw.json?.code === 0, weakPw.json?.msg ?? '');

  console.log('\n=== 退出 ===');
  const out = await call('POST', '/logout');
  check('退出返回成功', out.json?.code === 1);
  // 会话是无状态签名 cookie：退出靠 Set-Cookie 让浏览器丢掉它（Max-Age=0），
  // 服务端不维护黑名单，所以这里断言「响应让 cookie 过期」而不是「旧 cookie 立刻失效」。
  const setCookie = out.headers.get('set-cookie') ?? '';
  check('退出让 cookie 过期', /Max-Age=0/i.test(setCookie), setCookie);
  cookie = ''; // 模拟浏览器按 Max-Age=0 丢弃
  const afterOut = await call('GET', '/me');
  check('退出后 401', afterOut.status === 401);
} finally {
  for (const fn of pending.reverse()) await fn();
  execFileSync('sqlite3', [DB], {
    input:
      `DELETE FROM admins WHERE username='${USER}';
       UPDATE config SET v='${capOriginal}' WHERE k='admin_captcha';`,
  });
  console.log(`\n通过 ${pass} 项，失败 ${fail} 项`);
  if (fail) {
    console.log('失败项:', fails.join(', '));
    process.exit(1);
  }
}
