/**
 * 统计查询。
 *
 * 所有"按天"的口径都固定用 Asia/Shanghai（+8，无夏令时），
 * 与后台看板、模板里的时间显示保持一致 —— 这里不用 UTC。
 */
const SHANGHAI = 8 * 3600;

/** 今天 0 点（上海时区）的 unix 秒；offset 为往前推的天数 */
export function dayStart(ts: number, offset = 0): number {
  const d = new Date((ts + SHANGHAI) * 1000);
  d.setUTCHours(0, 0, 0, 0);
  return Math.floor(d.getTime() / 1000) - SHANGHAI - offset * 86400;
}

/** 某天的"天序号"（用于按天分组对齐） */
function dayKey(ts: number): number {
  return Math.floor((ts + SHANGHAI) / 86400);
}

/** 该时间戳对应的上海日期（YYYY-MM-DD），给看板的每日明细当标签用 */
export function dayLabel(ts: number): string {
  const d = new Date((ts + SHANGHAI) * 1000);
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${m}-${day}`;
}

export interface Totals {
  c: number;
  s: number;
}

/** 累计已收（status 1/2 都算钱已到账：1=回调成功，2=回调失败但钱到了） */
export async function paidTotals(db: D1Database): Promise<Totals> {
  const r = await db
    .prepare(
      "SELECT COUNT(*) AS c, COALESCE(SUM(CAST(truemoney AS REAL)),0) AS s FROM orders WHERE status IN (1,2)"
    )
    .first<Totals>();
  return { c: r?.c ?? 0, s: r?.s ?? 0 };
}

/** 指定时刻之后的已收 */
export async function paidSince(db: D1Database, since: number): Promise<Totals> {
  const r = await db
    .prepare(
      'SELECT COUNT(*) AS c, COALESCE(SUM(CAST(truemoney AS REAL)),0) AS s FROM orders WHERE status IN (1,2) AND pay_time >= ?'
    )
    .bind(since)
    .first<Totals>();
  return { c: r?.c ?? 0, s: r?.s ?? 0 };
}

/** 按天聚合（返回 dayKey → 汇总） */
export async function dailyPaid(
  db: D1Database,
  since: number
): Promise<Map<number, Totals>> {
  const r = await db
    .prepare(
      `SELECT CAST((pay_time + 28800) / 86400 AS INTEGER) AS d,
              COUNT(*) AS c,
              COALESCE(SUM(CAST(truemoney AS REAL)),0) AS s
         FROM orders
        WHERE status IN (1,2) AND pay_time >= ?
        GROUP BY d`
    )
    .bind(since)
    .all<{ d: number; c: number; s: number }>();

  const map = new Map<number, Totals>();
  for (const row of r.results) map.set(row.d, { c: row.c, s: row.s });
  return map;
}

/** 监控端最后一次心跳（0 = 从没连过） */
export async function lastHeart(db: D1Database): Promise<number> {
  const r = await db
    .prepare('SELECT last_heart FROM monitor_state WHERE id = 1')
    .first<{ last_heart: number }>();
  return Number(r?.last_heart ?? 0);
}

export { dayKey };
