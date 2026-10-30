import type { Env } from './db';
import { getConfigInt } from './db';
import { now } from './util';

/**
 * 金额池：把"分-类型"作为主键占位。
 *
 * 与旧版（php）完全一致的策略：
 *   INSERT OR IGNORE 抢占 → 失败就按 payQf 调整 1 分 → 最多试 10 次
 *
 * D1 是单写者，主键冲突即天然互斥，不需要事务或锁。
 *
 * @returns 分配成功返回实际应付分值；失败返回 null
 */
export async function allocatePrice(
  env: Env,
  fen: number,
  type: number,
  oid: string
): Promise<number | null> {
  const payQf = await getConfigInt(env, 'payQf', 1);
  let cur = fen;

  for (let i = 0; i < 10; i++) {
    if (cur <= 0) return null;
    const key = `${cur}-${type}`;
    const r = await env.DB.prepare(
      'INSERT OR IGNORE INTO tmp_price (price, oid, created_at) VALUES (?, ?, ?)'
    )
      .bind(key, oid, now())
      .run();
    if ((r.meta.changes ?? 0) > 0) return cur;
    cur += payQf === 2 ? -1 : 1;
  }
  return null;
}

/** 支付成功或订单关闭时释放占位 */
export async function releasePrice(env: Env, oid: string): Promise<void> {
  await env.DB.prepare('DELETE FROM tmp_price WHERE oid = ?').bind(oid).run();
}

/** 分 → 元，保留两位（避免浮点误差） */
export function fenToYuan(fen: number): string {
  const sign = fen < 0 ? '-' : '';
  const abs = Math.abs(fen);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** 元 → 分 */
export function yuanToFen(yuan: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(yuan)) return null;
  const [intPart, decPart = ''] = yuan.split('.');
  return Number(intPart) * 100 + Number(decPart.padEnd(2, '0'));
}
