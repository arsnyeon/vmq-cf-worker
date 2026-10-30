/**
 * 后台别名解析（adminAlias / primeAdminAlias）。
 *
 * 两条来源必须都成立：
 *   · env.ADMIN_ALIAS 配了 → 直接用，**不查库**（线上跑的就是这条，零额外开销）
 *   · env 没配 → 从 config.admin_alias 读，缓存 60 秒（开源版首次安装由 /setup 写入）
 */
import { adminAlias, primeAdminAlias, setAdminAliasCache } from '../src/lib/db.ts';

let failed = 0;
function check(name, got, want) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`  ${ok ? '✓' : '✗'} ${name}: ${JSON.stringify(got)}${ok ? '' : ` (期望 ${JSON.stringify(want)})`}`);
}

const fakeDb = (v, throwIt = false) => ({
  DB: {
    prepare: () => ({
      first: async () => {
        if (throwIt) throw new Error('no such table: config');
        return { v };
      },
    }),
  },
});

console.log('别名解析');

// 1) env 优先：即使库里是别的值，也用 env
const envWithVar = { ...fakeDb('from-db'), ADMIN_ALIAS: 'my-admin-alias' };
await primeAdminAlias(envWithVar);
check('env 优先', adminAlias(envWithVar), 'my-admin-alias');

// 2) env 带首尾斜杠/非法字符 → 归一化
check('归一化', adminAlias({ ADMIN_ALIAS: '/my-vault_1/' }), 'my-vault_1');
check('非法字符剔除', adminAlias({ ADMIN_ALIAS: '后台入口' }), 'admin');
check('空串回退', adminAlias({ ADMIN_ALIAS: '' }), 'admin');

// 3) env 没配 → 从 config 读（模拟 /setup 写入后的新实例）
check('prime 前回退默认', adminAlias(fakeDb('myvault')), 'admin');
const envNoVar = fakeDb('myvault');
await primeAdminAlias(envNoVar, true); // force：跳过缓存，模拟冷启动
check('prime 后用库里的值', adminAlias(envNoVar), 'myvault');

// 4) 表不存在（schema 未执行）→ 回退 admin，且不抛异常
const envBroken = fakeDb('', true);
await primeAdminAlias(envBroken, true); // 不应 throw
check('表不存在不抛错', adminAlias(envBroken), 'admin');

if (failed) {
  console.error(`别名解析失败 ${failed} 项`);
  process.exit(1);
}
console.log('全部通过（别名解析 7 项）');
