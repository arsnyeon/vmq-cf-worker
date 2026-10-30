/**
 * 展示层格式化：把库里的原始行转成接口/模板期望的形状。
 *
 * 只做"翻译"，不做业务判断 —— 业务在 service，SQL 在 repository。
 */
import { fmtTime } from '../../lib/page';

/** 把结果里的时间字段（unix 秒）格式化成模板期望的 Y-m-d H:i:s */
export function withTimes(
  r: Record<string, unknown>,
  fields: string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...r };
  for (const f of fields) out[f] = fmtTime(Number(r[f] ?? 0));
  return out;
}

/** 'YYYY-MM-DD' → 当天 0 点 / 23:59:59（上海时区）的 unix 秒；非法输入返回 undefined */
export function dayTs(v: string, endOfDay = false): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return undefined;
  const ms = Date.parse(`${v}T${endOfDay ? '23:59:59' : '00:00:00'}+08:00`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}
