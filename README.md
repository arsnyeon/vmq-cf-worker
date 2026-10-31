# V免签 · Cloudflare Workers 版

> 个人免签收款服务端，跑在 **Cloudflare Workers + D1** 上：零服务器、零运维、免费额度足够个人站点。
>
> 下单接口与监控端协议兼容原版，商户代码和 App 不用改；后台是独立的 React SPA。

**它解决什么问题**：你想在自己的站点上收几块钱，但不想接支付宝/微信的商户资质。V免签用「监听手机收款通知」来代替支付回调，把钱到账这件事自动化。

```
用户扫码付款 → 手机/电脑收到收款通知 → 监控端 App 监听到 → POST /appPush
                                                              ↓
                        按金额匹配订单 → 标记已支付 → 回调你的商户系统 → 发货
```

## 和 V免签、易支付的关系

这个项目**不是「V免签 + 易支付」两套东西拼在一起**，而是「**V免签 的一个 TypeScript / Workers 重写**」。它天生同时具备两个身份：

- **对外是易支付协议的兼容网关**（这是 V免签 原本的对外形态）：商户用标准参数下单、按同一套 MD5 规则验签、按同一套格式回调。已经接过易支付的商城，改个网关地址和通讯密钥就能用。
- **对内是个人收款码 + 手机监听的免签收单机**：没有支付回调，靠监控端 App 监听收款通知确认到账 —— 这就是「免签」二字的含义，也是 V免签 的内核。

所以「易支付的内容」本质只是 V免签 的商户接口层（`src/routes/submit.ts`、`src/lib/sign.ts`、`src/lib/notify.ts`），仓库主体仍是 V免签 的业务（通道、订单、金额池、监控端）。**本项目也没有对接任何第三方易支付网关**：全仓唯一的出站请求是回调你自己的 `notify_url`。

## 特性

| | |
|---|---|
| **零服务器** | 全部跑在 Cloudflare，不需要 VPS、不需要 MySQL |
| **免费额度够用** | Workers 10 万请求/天、D1 5GB，个人站点绰绰有余 |
| **双通道回调** | 服务端异步回调（带 8 次退避重试）+ 浏览器回跳兜底 |
| **金额池防串单** | 同一金额同一时间只能有一笔待支付订单，避免"钱到了不知道是谁的" |
| **独立后台** | React + shadcn 的 SPA，深色模式、分 tab 配置；不依赖任何 PHP 页面 |
| **一键初始化** | 部署后访问 `/setup` 创建管理员并随机生成密钥，没有默认密码 |

## 快速开始

### 0. 前置

- [Node.js](https://nodejs.org/) 20+（package.json 的 engines 要求）
- [Cloudflare 账号](https://dash.cloudflare.com/sign-up)（免费即可）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-update/)：`npm i -g wrangler`
- 一个监控端 App（见「监控端」一节）

```bash
wrangler login
```

### 1. 拉代码 + 装依赖

```bash
git clone https://github.com/im-webb/vmq-cf-worker.git
cd vmq-worker
pnpm install     # 或 npm install
```

### 2. 创建 D1 数据库

```bash
wrangler d1 create vmq
```

输出里会有 `database_id = "xxxx-xxxx-..."`，复制下来。

### 3. 填配置

```bash
cp wrangler.example.jsonc wrangler.local.jsonc
```

把 `wrangler.local.jsonc` 里的 `<your-database-id>` 换成上一步的 id。

> `wrangler.local.jsonc` 已在 `.gitignore` 里，不会被提交。
>
> **多个环境**（比如本地开发库一个账号、测试环境又一个账号）：把配置另存一份，
> 用环境变量指定即可，不用来回改文件：
>
> ```bash
> WRANGLER_CONFIG=wrangler.local.test.jsonc pnpm run deploy
> ```
>
> 不指定就走默认的 `wrangler.local.jsonc`。

### 4. 建表

```bash
pnpm db:remote        # 建表（schema.sql）
```

表结构是全部配置的来源；后台菜单由 SPA 内置，不需要额外数据。

> ⚠️ 必须带 `--remote`（脚本里已经带了）。不带的话只初始化本地模拟库，线上仍然是空的。

### 5. 部署

```bash
pnpm run deploy
```

> 必须写 `pnpm run deploy`：`pnpm deploy` 是 pnpm 自己的命令（用于 workspace 部署），
> 会报 `ERR_PNPM_NOTHING_TO_DEPLOY`，不会执行本项目的脚本。

它会先构建后台 SPA（`apps/admin`）与前台站点（`apps/web`），产物落到 `public/`，再随 Worker 一起上传。
完成后会给你一个 `https://vmq.<你的子域>.workers.dev` 地址。

### 6. 初始化（关键一步）

打开 `https://你的地址/setup`，填：

| 项 | 说明 |
|---|---|
| 管理员账号 / 密码 | 至少 8 位，**没有默认密码** |
| 后台入口别名 | 后台会挂在 `/<别名>`，建议别用 `admin` |
| 站点名称 | 显示在支付页上 |

提交后会显示**后台地址**和**通讯密钥**（只显示这一次）。通讯密钥用于监控端验签，之后也能在后台查看。

初始化完成后 `/setup` 自动关闭（再次访问返回 404）。

> **防抢注（可选）**：部署完到点开 `/setup` 之间，任何人先访问就能占走管理员。
> 想堵住这个窗口，先设一个初始化令牌：
>
> ```bash
> npx wrangler secret put SETUP_TOKEN        # 随便一串只有你知道的值
> ```
>
> 之后必须用 `/setup?token=<令牌>` 打开；表单里会自动带上令牌，提交不需要手动加。
> 初始化完成后可以删掉：`npx wrangler secret delete SETUP_TOKEN`。

### 7. 后台配置

登录 `/<别名>/login`：

1. **通道管理** → 新增通道（微信 / 支付宝 / QQ / 数字人民币），填收款码
2. **系统配置 → 站点信息** → 站点地址、站点名称等（站点地址在 `/setup` 时已自动写成当前域名，可改）
3. **系统配置 → 密钥管理** → 通讯密钥就在这里；商户下单签名和监控端签名共用同一把

> 回调成功判定（`notify_success_body`，默认 `success`）暂时没有后台入口，需要改库：
>
> ```bash
> npx wrangler d1 execute vmq --remote --command "UPDATE config SET v='@json:code=1' WHERE k='notify_success_body'"
> ```
>
> 三种取值见下面「异步回调」一节。

### 8. 绑定监控端

用监控端 App 扫描后台「通道管理」列表里的「APP扫码配置」二维码，或在 App 里按同样格式手动填写：

```
https://your-domain.com/通讯密钥/通道id,支付类型      例：https://pay.example.com/3f9a…/8,1
```

域名取「系统配置 → 站点信息」的站点地址，没配则用你访问后台时所用的域名。

## 接口

### 创建订单（你的站点 → 本站）

```
POST /api/order/create
```

> 旧版 PHP 站的 `/submit.php`（以及 `/submit`）仍然可用，已经写死旧地址的商户代码不用改。
> 新接入请用 `/api/order/create`，和查询接口 `/api/order/status` 成对。

| 参数 | 必填 | 说明 |
|---|---|---|
| `pid` | ✅ | 商户 ID，会写进订单与回调；自定义即可，后台不做比对 |
| `type` | ✅ | `wxpay` / `alipay` / `qqpay` / `rmb`（也接受 1/2/3/4） |
| `out_trade_no` | ✅ | 你的订单号，必须唯一 |
| `name` | ✅ | 商品名 |
| `money` | ✅ | 金额，两位小数 |
| `notify_url` | ✅ | 异步回调地址，**必须是域名，不能用裸 IP** |
| `return_url` | | 支付完成后浏览器跳转地址 |
| `sitename` | | 站点名 |
| `sign` | ✅ | 见下 |
| `sign_type` | | 固定 `MD5` |

签名：把所有非空参数按 **参数名 ASCII 升序** 拼成 `k1=v1&k2=v2`，末尾直接接通讯密钥，取 MD5：

```
sign = md5("money=1.00&name=月卡&notify_url=...&out_trade_no=...&pid=1001&return_url=...&sitename=...&type=wxpay" + 通讯密钥)
```

> `sign`、`sign_type` 不参与签名。响应默认 302 到支付页；带 `format=json` 时返回 JSON。

### 异步回调（本站 → 你的 notify_url）

GET 请求，参数：

```
pid, type, out_trade_no, trade_no, trade_status=TRADE_SUCCESS,
money, really_money, name, sitename, sign, sign_type=MD5
```

验签规则与下单一致。**返回什么算成功**取决于后台「回调成功判定」：

| 取值 | 判定 |
|---|---|
| `success`（默认） | 响应体去空白后等于 success |
| `@any2xx` | 只看 HTTP 状态码 2xx |
| `@json:code=1` | 响应体是 JSON 且 `code` 字段为 1 |

失败会按 30s → 2m → 10m → 1h → 6h 退避重试，最多 8 次。

> 同一笔订单可能收到多次回调（服务端回调 + 浏览器回跳），**你的接口必须幂等**：
> 先查 `out_trade_no` 是否已处理，已处理直接返回成功。

### 其他

| 接口 | 用途 |
|---|---|
| `GET /checkOrder?orderId=` | 支付页轮询状态 |
| `POST /appPush` | 监控端推送到账（`type, price, t, pid, sign`） |
| `POST /appHeart` | 监控端心跳（60 秒内无心跳会拒单） |
| `GET /enQrcode?url=` | 现场生成二维码 PNG |
| `GET /api/health` | 健康检查 |

## 常见问题

**Q：回调一直失败，错误是 `403 error code: 1003`？**
`notify_url` 用了裸 IP。Cloudflare 只认 zone 自己的域名，请求 IP 会被拒。换成域名即可 —— **不要用 IP 做回调地址**。

**Q：后台显示"监控端离线"，下不了单？**
监控端 60 秒没心跳就会拒单。检查 App 是否被系统杀掉（需要保活 / 自启动权限），或在后台把 `require_online` 改成 0 临时放开。

**Q：忘记管理员密码？**
在 D1 里清空管理员表，重新访问 `/setup`：

```sql
DELETE FROM admins;
```

再打开 `/setup` 重设账号。**通讯密钥不会被重新生成**，监控端不用重新绑定。

**Q：上传图片提示"编码后超出数据库单条上限"？**
图片以 base64 存 D1，D1 单个值上限 2MB，所以原始文件限制在 1.4MB。收款码通常只有几十 KB，够用。要传大图建议改用 R2。

**Q：换域名要改哪些地方？**
① `wrangler.local.jsonc` 的 `routes`；② 后台「系统配置 → 站点信息」的站点地址；③ 商户侧的 `notify_url`。监控端二维码里的域名也要重新扫。

## 本地开发

```bash
pnpm dev           # 本地起服务（D1 用本地模拟库）
pnpm test          # 类型 + 模板渲染 + 签名 + 二维码解码 + 路由，全量自检
pnpm check:leak    # 提交前自检：确认没把真实域名 / 密钥写进仓库
```

本地库初始化：

```bash
pnpm db:local
```

目录结构：

```
src/
  index.ts              路由入口
  routes/               后台 / 支付 / 推送 / 站点 / 初始化
  lib/                  签名、二维码、配置读取、D1 封装
  templates/pay.ts       支付页（内联样式，无外部 CSS 依赖）
public/                 构建产物与静态图，随 Worker 一起发布
schema.sql              D1 表结构
seed.sql                预留的种子数据入口（当前为空）
wrangler.example.jsonc  配置模板（复制成 wrangler.local.jsonc 再填）
```

## 许可与致谢

- 本项目全部代码（Worker、前台、后台 SPA、支付页）以 **MIT** 发布，见 [LICENSE](./LICENSE)
- `public/static/pay/3/img/` 下是微信 / 支付宝 / QQ / 数字人民币的官方标识，
  仅用于标示支付方式，商标权归各自权利人
- 仓库不包含任何第三方页面模板或后台 UI 框架

> 仅供个人学习与自用。请遵守当地法律法规与合作平台的服务条款，不要用于违法用途。
