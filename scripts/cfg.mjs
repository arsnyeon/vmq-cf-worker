/**
 * 打印当前要用的 wrangler 配置路径。
 *
 * 仓库里只有 `wrangler.example.jsonc`（占位值），真实配置在 `wrangler.local.jsonc`
 * （含 database_id / 别名，已被 .gitignore 排除）。
 * 这样开源出去不会把线上的数据库 ID 和后台路径带进 git。
 */
import { existsSync } from 'node:fs';

if (existsSync('wrangler.local.jsonc')) {
  console.log('wrangler.local.jsonc');
} else if (existsSync('wrangler.jsonc')) {
  // 兼容：老版本把这文件直接叫 wrangler.jsonc
  console.log('wrangler.jsonc');
} else {
  console.error(
    '\n缺少 wrangler 配置。先执行：\n' +
      '  cp wrangler.example.jsonc wrangler.local.jsonc\n' +
      '然后把 database_id 换成 `wrangler d1 create vmq` 返回的那个 id。\n'
  );
  process.exit(1);
}
