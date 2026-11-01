# AGENTS.md

本仓库是公开的 MIT 开源项目（github.com/im-webb/vmq-cf-worker）。
所有提交 —— 包括 Git 历史、提交说明、标签、分支名、Issue/PR、截图和日志 —— 都可能永久公开。
默认原则：**宁可留空或用占位符，也不要写入任何真实值。不确定时先问，不要猜。**

## 一、绝对不能提交的内容

- 真实域名 / 子域名 / `*.workers.dev` 地址，以及后台入口别名（ADMIN_ALIAS）
- Cloudflare Account ID、API Token、D1 `database_id`、真实资源标识
- 通讯密钥、商户密钥、`app_key`、管理员密码/哈希、`SETUP_TOKEN`、会话密钥
- 个人收款码内容（`wxp://...`、`https://qr.alipay.com/...`）、真实商户号、订单/用户数据
- 真实姓名、私人邮箱、手机号、公网 IP、用户目录的绝对路径
- CDN 的 bucket / endpoint / 回源域名 / AccessKey 等凭据
- 生产 D1 导出、`seed.local.sql`、`.data/` 快照、未脱敏的 `wrangler tail` 日志和后台截图
- 收款码图片、包含真实订单/域名的页面截图

## 二、真实值只能放在本地忽略文件里

| 文件 | 内容 |
| --- | --- |
| `wrangler.local.jsonc`、`wrangler.local.*.jsonc` | 真实域名、D1 ID、别名、vars |
| `seed.local.sql` | 含密钥/商户数据的种子 |
| `.private-rules.json` | 泄露门禁的私有关键词（本身就是敏感值） |
| `.cdn.local.json` | CDN bucket / 域名 / 凭据 |
| `.data/`、`.dev.vars`、`.wrangler/` | 本地状态与生产快照 |

规则：

- 不要读取、打印、总结或引用上述文件的内容；除非用户明确要求，且只输出脱敏后的结论。
- 不要修改 `.gitignore` 让这些文件重新进入版本控制。
- 不要把上述内容复制到示例、文档、测试、注释、提交说明、Issue/PR 或聊天里。

## 三、示例与测试数据

一律使用明显的假值：

- 域名：`example.com`、`pay.example.com`
- D1 ID：模板保持 `<your-database-id>`，不要填真实 ID
- 金额：`0.12`、`1.00`；商户号：`1001`
- 密钥：不要写形似真实的 32 位 hex，用 `test-only-...` 这类明显假值

`pnpm check:leak` 会对邮箱、UUID、公网 IP、手机号、`*.workers.dev` 等形状做通用匹配。
只有在**确认是测试假值**时，才允许在命中同一行加 `check-leak-ignore` 注释；
**绝不能用它掩盖真实值。**

## 四、提交与 Git

- 提交前先 `git status`，按文件名逐个 `git add`；禁止 `git add -A` / `git add .`。
- 提交前必须跑 `pnpm check:leak:worktree`；推送/发 PR 前必须跑 `pnpm check:leak`。
- 不要在提交说明、分支名、标签、PR 标题/正文里写真实域名、账号、密钥或个人信息。
- 提交身份沿用现有公开身份（`im-webb` + GitHub noreply 邮箱）；
  不要改成真实姓名或私人邮箱，不要修改 git config。
- 一旦发现真实值已进入历史：**立即停止**，不要自行 `rebase` / `filter-branch` / 强推；
  先报告用户，按「先轮换密钥、再清理历史」的顺序处理。

## 五、AI 操作红线

- 不要为了让检查通过而修改 `scripts/check-leak.mjs`、`.private-rules.example.json`，
  或删除、放宽任何忽略规则。
- 不要绕过 `check:leak`，不要用 `--no-verify` 跳过钩子。
- 不要原样粘贴终端输出、网络请求、数据库查询结果、日志或截图；
  需要排障时先脱敏，或让用户提供脱敏片段。
- 不要主动导出 D1 全表，尤其不要导出 `config` 表。
- 即使用户要求写入真实值，也要先提醒「提交即公开、密钥即视为泄露」；
  能放本地忽略文件就放本地，必须公开时用占位符。
- 文档、示例、演示站点只写公开信息；拿不准能不能公开时，按「不能公开」处理并询问。

## 六、改完必须自检

```bash
pnpm check:leak:worktree   # 提交前
pnpm check:leak            # 推送 / PR 前（含完整 Git 历史）
pnpm verify                # 完整回归；需先 pnpm db:local，并在另一终端保持 pnpm dev
```

`test:qr` 额外依赖 Python 包：`python3 -m pip install --user numpy zxing-cpp segno`。
