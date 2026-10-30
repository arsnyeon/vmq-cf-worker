#!/usr/bin/env node
/**
 * 反代场景的对外域名/协议推断测试。
 *
 * 背景：站点挂在 nginx 后面时 Host 会被改成 Worker 域名（workers.dev 按 Host 路由，
 * 不改就是 403/404），真正给用户看的域名只在 X-Forwarded-Host 里。
 * 生成的绝对链接、二维码必须用对外域名，否则用户会从 pay.example.com 被带到 workers.dev。
 */
import { externalHost, externalProto, publicUrl } from '../src/lib/util.ts';

let bad = 0;
function eq(got, want, label) {
  if (got !== want) {
    bad++;
    console.log('FAIL', label, 'got', JSON.stringify(got), 'want', JSON.stringify(want));
  }
}

const base = 'https://vmq.example.workers.dev/demo?x=1';

// 直连 Worker：没有反代头，用请求自己的 host
eq(externalHost(new Request(base)), 'vmq.example.workers.dev', 'direct host');
eq(externalProto(new Request(base)), 'https', 'direct proto');

// 反代：Host 是 Worker，X-Forwarded-Host 是真实域名
eq(
  externalHost(new Request(base, { headers: { 'x-forwarded-host': 'pay.example.com' } })),
  'pay.example.com',
  'forwarded host'
);
eq(
  externalProto(new Request(base, { headers: { 'x-forwarded-proto': 'https' } })),
  'https',
  'forwarded proto'
);
eq(
  externalProto(new Request('http://x/y', { headers: { 'x-forwarded-proto': 'https' } })),
  'https',
  'forwarded proto overrides http'
);

// 多级反代：取第一个
eq(
  externalHost(new Request(base, { headers: { 'x-forwarded-host': 'pay.example.com, inner.local' } })),
  'pay.example.com',
  'multi proxy first value'
);

// 非法 proto 忽略，回退到请求协议
eq(
  externalProto(new Request(base, { headers: { 'x-forwarded-proto': 'ftp' } })),
  'https',
  'invalid proto falls back'
);

// 拼绝对地址
eq(
  publicUrl(new Request(base, { headers: { 'x-forwarded-host': 'pay.example.com' } }), '/index/pay/page?trade_no=1'),
  'https://pay.example.com/index/pay/page?trade_no=1',
  'publicUrl'
);
eq(
  publicUrl(new Request(base), 'pay/123'),
  'https://vmq.example.workers.dev/pay/123',
  'publicUrl adds leading slash'
);

console.log(bad === 0 ? '全部通过（反代头推断）' : `失败 ${bad} 个`);
process.exit(bad === 0 ? 0 : 1);
