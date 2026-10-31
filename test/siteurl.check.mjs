#!/usr/bin/env node
/**
 * 站点域名 → 监控端 App 配置。
 *
 * 盯的是一条很容易错的链路：后台「通道管理」给每个通道生成的
 * 「APP扫码配置 / APP手动配置」字符串必须是
 *
 *     域名/通讯密钥/通道id,支付类型       例：pay.example.com/3f9a…/8,1
 *
 * 三处必须同时对，错一处 App 就绑不上或者心跳/推送验签失败：
 *   1. 域名**不能带协议** —— App 自己拼的是 http://host/appPush
 *   2. 域名优先取后台「站点地址」(config.url)，没配才用当前请求的 host
 *   3. 密钥必须与 /appPush 验签同源（appSecret：app_key → key → epaykey_ali）
 */
import { handleSetup } from '../src/routes/setup.ts';
import { listPassages } from '../src/modules/passages/passage.service.ts';
import { appSecret } from '../src/lib/db.ts';
import { monitorSign, verifyMonitor } from '../src/lib/sign.ts';
import { hostOf } from '../src/lib/util.ts';

let bad = 0;
function eq(got, want, label) {
  if (got !== want) {
    bad++;
    console.log('FAIL', label, 'got', JSON.stringify(got), 'want', JSON.stringify(want));
  }
}

/* ---------------- hostOf：站点地址的各种手填写法 ---------------- */
eq(hostOf('https://pay.example.com/'), 'pay.example.com', 'hostOf 带协议+尾斜杠');
eq(hostOf('http://pay.example.com'), 'pay.example.com', 'hostOf http');
eq(hostOf('pay.example.com'), 'pay.example.com', 'hostOf 裸域名');
eq(hostOf('pay.example.com/sub/'), 'pay.example.com', 'hostOf 带子路径');
eq(hostOf('https://pay.example.com:8443'), 'pay.example.com:8443', 'hostOf 保留端口');
eq(hostOf('  https://pay.example.com  '), 'pay.example.com', 'hostOf 去首尾空格');
eq(hostOf(''), '', 'hostOf 空串');
eq(hostOf('   '), '', 'hostOf 纯空格');

/* ---------------- 假 D1：只实现列表 + 读 config ---------------- */
function makeEnv(config = {}, rows = []) {
  return {
    DB: {
      prepare(sql) {
        const stmt = (args = []) => ({
          async first() {
            if (/COUNT\(\*\) AS c FROM passages/.test(sql)) return { c: rows.length };
            if (/^SELECT v FROM config/.test(sql)) {
              const v = config[args[0]];
              return v === undefined ? null : { v };
            }
            return null;
          },
          async all() {
            if (/^SELECT id, type, code/.test(sql)) return { results: rows };
            return { results: [] };
          },
        });
        return {
          bind: (...args) => stmt(args),
          first: () => stmt([]).first(),
          all: () => stmt([]).all(),
        };
      },
    },
  };
}

const ROW = {
  id: 8,
  type: 1,
  code: 0,
  zf_pid: '',
  ewm_type: 0,
  ewm: 'wxp://demo',
  balance: '0',
  succcount: 0,
  succprice: '0',
  is_status: 0,
  status: 1,
  money_change: 0,
  pay_qf: 0,
  create_time: 0,
  run_time: 0,
  remarks: 'demo',
};

/** 取第一行生成的 APP 扫码配置 */
async function appConfigOf(config, reqHost = '') {
  const res = await listPassages(makeEnv(config, [ROW]), { limit: '10' }, reqHost);
  return res.data[0].app_config;
}

/* ---------------- 域名：优先 config.url，且必须剥掉协议 ---------------- */
eq(
  await appConfigOf({ url: 'https://pay.example.com/', key: 'KEY123' }),
  'pay.example.com/KEY123/8,1',
  '站点地址带协议也能剥干净'
);
eq(
  await appConfigOf({ url: 'https://pay.example.com/vmq/', key: 'KEY123' }),
  'pay.example.com/KEY123/8,1',
  '站点地址带子路径只取域名'
);
eq(
  await appConfigOf({ key: 'KEY123' }, 'p9.example.workers.dev'),
  'p9.example.workers.dev/KEY123/8,1',
  '未配站点地址时用请求 host 兜底'
);
eq(
  await appConfigOf({ url: 'https://pay.example.com/', key: 'KEY123' }, 'p9.example.workers.dev'),
  'pay.example.com/KEY123/8,1',
  '配了站点地址就优先于请求 host'
);

/* ---------------- 密钥：取值顺序必须和 /appPush 验签一致 ---------------- */
eq(
  await appConfigOf({ url: 'https://pay.example.com/', app_key: 'NEW', key: 'OLD' }),
  'pay.example.com/NEW/8,1',
  'app_key 优先于 key'
);
eq(
  await appConfigOf({ url: 'https://pay.example.com/', epaykey_ali: 'LEGACY' }),
  'pay.example.com/LEGACY/8,1',
  '只剩历史 epaykey_ali 也能用'
);

// 拿列表里的密钥去签一次 appPush，必须和 /appPush 的验签对得上
{
  const env = makeEnv({ url: 'https://pay.example.com/', key: 'PUSHKEY' }, [ROW]);
  const cfg = (await listPassages(env, { limit: '10' }, '')).data[0].app_config;
  const [, emittedKey] = cfg.split('/');
  const t = '1761900000';
  const pid = '8';
  const sign = monitorSign([t, pid], emittedKey); // App 端心跳签名
  eq(verifyMonitor([t, pid], sign, await appSecret(env)), true, '扫码配置里的密钥能过 /appHeart 验签');
}

/* ---------------- 缺域名或密钥 → 给空串，别给半截字符串 ---------------- */
eq(await appConfigOf({ url: 'https://pay.example.com/' }, 'req.example.com'), '', '没配密钥返回空');
eq(await appConfigOf({ key: 'KEY123' }, ''), '', '域名也没认到时返回空');

/* ---------------- /setup：初始化要顺手把站点地址写进 config ---------------- */
{
  const written = [];
  const env = {
    DB: {
      prepare(sql) {
        const binds = [];
        return {
          bind(...args) {
            binds.push(...args);
            return this;
          },
          async first() {
            if (/COUNT\(\*\) AS c FROM admins/.test(sql)) return { c: 0 };
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            written.push({ sql, binds });
            return { meta: {} };
          },
        };
      },
      async batch(stmts) {
        for (const s of stmts) await s.run();
      },
    },
  };
  const form = new URLSearchParams({
    username: 'boss_ok',
    password: 'Aa12345678',
    password2: 'Aa12345678',
    alias: 'myvault',
    sitename: '演示站',
  });
  const res = await handleSetup(
    new Request('https://pay.example.com/setup', { method: 'POST', body: form }),
    env
  );
  eq(res.status, 200, '/setup 提交成功');
  const kv = Object.fromEntries(written.map((w) => [w.binds[0], w.binds[1]]));
  eq(kv['url'], 'https://pay.example.com', '/setup 写入站点地址（不含尾斜杠）');
  eq(kv['title'], '演示站', '/setup 写入站点名称');
  eq(kv['admin_alias'], 'myvault', '/setup 写入后台别名');
  eq(/^INSERT INTO admins/.test(written[0].sql), true, '/setup 建管理员');

  // 反代场景：对外域名只在 X-Forwarded-Host 里，不能把 Worker 自己的域名写进去
  written.length = 0;
  await handleSetup(
    new Request('https://vmq.internal.workers.dev/setup', {
      method: 'POST',
      body: form,
      headers: { 'x-forwarded-host': 'pay.example.com', 'x-forwarded-proto': 'https' },
    }),
    env
  );
  const kv2 = Object.fromEntries(written.map((w) => [w.binds[0], w.binds[1]]));
  eq(kv2['url'], 'https://pay.example.com', '/setup 认 X-Forwarded-Host');
}

console.log(bad === 0 ? '✓ 站点域名 / APP 配置全部通过' : `✗ ${bad} 项失败`);
if (bad) process.exit(1);
