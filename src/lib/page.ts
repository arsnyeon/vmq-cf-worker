/** 页面渲染的公共部分：占位符替换、时间格式化、配置读取 */

import type { Env } from './db';
import { externalHost, externalProto } from './util';

const SHANGHAI = 8 * 3600;

/**
 * 静态资源基址（末尾不带斜杠）。
 *
 * 解析顺序：
 *   1) 后台「静态资源地址」（config.resource_url）**存在这一行** → 就用它；
 *      值为空串 = 用相对路径 /static/…（配合 wrangler.jsonc 的 assets 由 Worker 自己分发）
 *   2) 没有这一行 → 回退环境变量 RESOURCE_URL（兼容老部署，全新库不配置也不会白屏）
 */
export function staticBase(cfg: Settings, env: Env): string {
  const raw = Object.prototype.hasOwnProperty.call(cfg, 'resource_url')
    ? (cfg['resource_url'] ?? '')
    : (env.RESOURCE_URL ?? '');
  return raw.trim().replace(/\/+$/, '');
}

/**
 * 站点 host（不带协议）：配置了 site.url 就用它，否则取当前请求的 host。
 * 监控端扫码绑定的地址要靠它，配置里写的是域名时比 req 更准。
 */
export function siteHost(cfg: Settings, req?: Request): string {
  const configured = (cfg['url'] ?? '').trim();
  if (configured) {
    try {
      return new URL(configured).host;
    } catch {
      /* 配置里可能不是完整 URL，退回 req */
    }
  }
  return req ? new URL(req.url).host : '';
}

/** 时间戳 → 'Y-m-d H:i:s'（东八区） */
export function fmtTime(ts: number): string {
  if (!ts) return '';
  const d = new Date((ts + SHANGHAI) * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

export type Settings = Record<string, string>;

export async function loadSettings(env: Env): Promise<Settings> {
  const rows = await env.DB.prepare('SELECT k, v FROM config').all<{ k: string; v: string }>();
  const out: Settings = {};
  for (const r of rows.results) out[r.k] = r.v;
  return out;
}

/** 站点公共变量：模板里的 {$title} / {$footer} 等 */
export function siteVars(s: Settings): Record<string, unknown> {
  return {
    title: s['title'] ?? 'V免签',
    keywords: s['keywords'] ?? '',
    description: s['description'] ?? '',
    footer: s['footer'] ?? '',
    edition: s['edition'] ?? 'v1.0.0',
    url: s['url'] ?? '',
    qq: s['qq'] ?? '',
    weixin: s['weixin'] ?? '',
    phone: s['phone'] ?? '',
    email: s['email'] ?? '',
  };
}

export function serverVars(req: Request): Record<string, string> {
  const u = new URL(req.url);
  return {
    // 反代后面要用 X-Forwarded-Host，模板里的绝对链接（支付宝二维码等）才不会指回 Worker 域名
    HTTP_HOST: externalHost(req),
    HTTP_USER_AGENT: req.headers.get('user-agent') ?? '',
    HTTPS: externalProto(req) === 'https' ? 'on' : '',
    REQUEST_URI: u.pathname + u.search,
  };
}

/** 由请求推断协议前缀，拼给模板里的 $http_type */
export function httpType(req: Request): string {
  return `${externalProto(req)}://`;
}
