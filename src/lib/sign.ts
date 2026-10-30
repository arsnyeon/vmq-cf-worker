import { md5 } from './md5.ts';
import { safeEqual } from './util.ts';

/**
 * 易支付标准签名串：
 *   剔除 sign / sign_type 与空值 → 按 key 升序 → 拼成 k=v&k=v
 *
 * 与 public/SDK.zip 里的 paraFilter + argSort + createLinkstring 等价。
 * ⚠️ 注意：PHP SDK 的 paraFilter 实际并没有过滤空值（那几行被注释掉了），
 *    这里按"过滤空值"实现，与常见商户端实现保持一致。
 *    只要双方都不传空值参数，行为一致。
 */
export function epaySignString(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] !== undefined)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

/** 下单 / 回调签名：md5(签名串 + 商户key) */
export function epaySign(params: Record<string, string>, key: string): string {
  return md5(epaySignString(params) + key);
}

export function verifyEpay(params: Record<string, string>, key: string): boolean {
  const sign = params['sign'] ?? '';
  if (!sign) return false;
  return safeEqual(sign.toLowerCase(), epaySign(params, key));
}

/**
 * 监控端签名：字段直接拼接（无分隔符）后 md5。
 *   appPush : md5(type + price + t + pid + key)
 *   appHeart: md5(t + pid + key)
 */
export function monitorSign(fields: Array<string | number>, key: string): string {
  return md5(fields.map((f) => String(f)).join('') + key);
}

export function verifyMonitor(
  fields: Array<string | number>,
  sign: string,
  key: string
): boolean {
  if (!sign) return false;
  return safeEqual(sign.toLowerCase(), monitorSign(fields, key));
}
