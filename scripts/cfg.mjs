/**
 * 打印当前要用的 wrangler 配置路径。
 *
 * 仓库里只有 `wrangler.example.jsonc`（占位值），真实配置在 `wrangler.local.jsonc`
 * （含 database_id / 别名，已被 .gitignore 排除）。
 * 这样开源出去不会把线上的数据库 ID 和后台路径带进 git。
 *
 * 有多个环境（本地开发库 / 测试账号 / 正式账号）时，用环境变量显式指定：
 *   WRANGLER_CONFIG=wrangler.local.newacc.jsonc pnpm deploy
 * 不指定就走默认的 wrangler.local.jsonc。
 *
 * ⚠️ stdout 只输出「配置路径」这一行，因为它会被 `-c "$(node scripts/cfg.mjs)"` 直接吃掉；
 * 任何提示都必须走 stderr，否则会把命令拼坏。
 */
import { existsSync, readdirSync } from 'node:fs';

const explicit = process.env.WRANGLER_CONFIG;
if (explicit) {
  if (!existsSync(explicit)) {
    console.error(`\nWRANGLER_CONFIG 指向的配置文件不存在：${explicit}\n`);
    process.exit(1);
  }
  console.log(explicit);
  process.exit(0);
}

/**
 * 没显式指定时，如果目录里躺着多份 wrangler 配置，就大声提醒一次。
 *
 * 为什么要提醒：这些配置各自绑不同的 D1 database_id，而 wrangler 用的是
 * 「当前登录的账号」。拿 A 账号的配置去 B 账号执行，报错是
 * `could not be found [7404]` / `D1 binding 'DB' references database 'xxxx' which was not found [10181]`，
 * 信息里根本不提「你可能选错了配置文件」，很容易排查半天。
 */
const others = readdirSync('.')
  .filter((f) => /^wrangler\.local.*\.jsonc$/.test(f) || f === 'wrangler.jsonc')
  .sort();

/** 默认选哪份：优先 wrangler.local.jsonc；只有一个本地配置就用它；再退到 wrangler.jsonc */
const picked = existsSync('wrangler.local.jsonc')
  ? 'wrangler.local.jsonc'
  : others.length === 1
    ? others[0]
    : existsSync('wrangler.jsonc')
      ? 'wrangler.jsonc'
      : '';

if (!picked) {
  console.error(
    '\n缺少 wrangler 配置。先执行：\n' +
      '  cp wrangler.example.jsonc wrangler.local.jsonc\n' +
      '然后把 database_id 换成 `wrangler d1 create vmq` 返回的那个 id。\n'
  );
  process.exit(1);
}

if (others.length > 1) {
  console.error(
    [
      '',
      `⚠️  未设置 WRANGLER_CONFIG，默认使用 ${picked}`,
      `    目录里有多份配置，它们绑的是不同的 D1：${others.join('、')}`,
      '    用错会报 7404 / 10181（database not found），因为 wrangler 认的是当前登录的账号。',
      `    切换：export WRANGLER_CONFIG=${others.find((f) => f !== picked) ?? others[0]}`,
      '',
    ].join('\n')
  );
}

console.log(picked);
