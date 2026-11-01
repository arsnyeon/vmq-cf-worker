/**
 * 通道（收款账号）数据访问。
 *
 * 一张 passages 行 = 一个收款渠道实例：支付类型 + 收款码 + 金额规则 + 开关。
 * 订单下单时按 type/code 从这里挑一条可用的。
 */
import { now } from '../../lib/util';
import { marks } from '../shared/sql';

/** 可写字段（顺序即表单字段顺序） */
export const PASSAGE_FIELDS = [
  'type',
  'code',
  'zf_pid',
  'ewm_type',
  'ewm',
  'status',
  'money_change',
  'pay_qf',
  'transfer',
  'hang_free',
  'remarks',
] as const;

/** 文本型字段（其余按数字存） */
const TEXT_FIELDS = new Set<string>(['zf_pid', 'ewm', 'remarks']);

/**
 * 列表查询列。
 *
 * `succcount` / `succprice` **不再读表里的同名列**，改为从 orders 实时聚合。
 *
 * 原因：passages 表虽然有这两列，但**全仓没有任何地方写过它们** ——
 * 既没有在下单时累加，也没有在收款回调里更新，所以恒为建表默认值 0，
 * 界面上就出现「明明有订单和收款记录，收款笔数/金额却都是 0」。
 *
 * 为什么改成实时算而不是补写入逻辑：
 *   1. 已有历史订单立刻就能统计对，不需要写迁移脚本回填；
 *   2. 不存在「写入漏了某条路径」导致长期偏差的问题（比如回调重试、手动补单）；
 *   3. 通道数量是几十条级别，配合 idx_orders_passage 索引，开销可以忽略。
 *
 * 口径与概览页保持一致：`status IN (1,2)` 都算钱已到账
 *（1 = 回调成功，2 = 回调失败但款已收到），金额取实际收款额 truemoney。
 * 金额用「分」做整数累加再除回元，避免 REAL 浮点累加误差（0.1+0.2 那类）。
 */
const LIST_COLUMNS = `
  id, type, code, zf_pid, ewm_type, ewm, status,
  money_change, pay_qf, create_time, remarks,
  (SELECT COUNT(*) FROM orders o
     WHERE o.passage_id = passages.id AND o.status IN (1, 2)) AS succcount,
  (SELECT printf('%.2f', COALESCE(SUM(CAST(ROUND(o.truemoney * 100) AS INTEGER)), 0) / 100.0)
     FROM orders o
     WHERE o.passage_id = passages.id AND o.status IN (1, 2)) AS succprice
`;

export interface PassageListFilter {
  type?: number;
  code?: number;
  status?: number;
  /** 创建时间范围（unix 秒，含边界） */
  startTs?: number;
  endTs?: number;
  /** 支付用户ID（精确） */
  zfPid?: string;
  /** 备注（模糊） */
  remarks?: string;
  limit: number;
  offset: number;
}

export type PassageListRow = Record<string, unknown> & {
  id: number;
  type: number;
  code: number;
};

export async function list(
  db: D1Database,
  f: PassageListFilter
): Promise<{ rows: PassageListRow[]; count: number }> {
  const where: string[] = [];
  const binds: unknown[] = [];
  for (const k of ['type', 'code', 'status'] as const) {
    const v = f[k];
    if (v !== undefined) {
      where.push(`${k} = ?`);
      binds.push(v);
    }
  }
  if (f.startTs !== undefined) {
    where.push('create_time >= ?');
    binds.push(f.startTs);
  }
  if (f.endTs !== undefined) {
    where.push('create_time <= ?');
    binds.push(f.endTs);
  }
  if (f.zfPid) {
    where.push('zf_pid = ?');
    binds.push(f.zfPid);
  }
  if (f.remarks) {
    where.push("remarks LIKE ? ESCAPE '\\'");
    binds.push(`%${f.remarks.replace(/[%_\\]/g, (c) => '\\' + c)}%`);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const cnt = await db
    .prepare(`SELECT COUNT(*) AS c FROM passages ${w}`)
    .bind(...binds)
    .first<{ c: number }>();

  const rows = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM passages ${w} ORDER BY id ASC LIMIT ? OFFSET ?`)
    .bind(...binds, f.limit, f.offset)
    .all<PassageListRow>();

  return { rows: rows.results, count: cnt?.c ?? 0 };
}

export async function findById(
  db: D1Database,
  id: number
): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT * FROM passages WHERE id = ?').bind(id).first();
  return (row as Record<string, unknown>) ?? null;
}

/** 表单参数 → 可写字段（文本 / 数字分别处理，未传的字段跳过） */
export function parseFields(p: Record<string, string>): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  for (const f of PASSAGE_FIELDS) {
    if (p[f] === undefined) continue;
    data[f] = TEXT_FIELDS.has(f) ? p[f] : Number(p[f]) || 0;
  }
  return data;
}

export async function insert(db: D1Database, data: Record<string, unknown>): Promise<number> {
  const keys = Object.keys(data);
  const values = keys.map((k) => data[k]);
  const r = await db
    .prepare(`INSERT INTO passages (${keys.join(',')}) VALUES (${marks(keys.length)})`)
    .bind(...values)
    .run();
  return Number(r.meta.last_row_id ?? 0);
}

export async function update(
  db: D1Database,
  id: number,
  data: Record<string, unknown>
): Promise<void> {
  const keys = Object.keys(data);
  if (!keys.length) return;
  await db
    .prepare(`UPDATE passages SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
    .bind(...keys.map((k) => data[k]), id)
    .run();
}

export async function removeMany(db: D1Database, idList: number[]): Promise<void> {
  if (!idList.length) return;
  await db
    .prepare(`DELETE FROM passages WHERE id IN (${marks(idList.length)})`)
    .bind(...idList)
    .run();
}

export async function setStatus(db: D1Database, id: number, status: number): Promise<void> {
  await db.prepare('UPDATE passages SET status = ? WHERE id = ?').bind(status, id).run();
}

/** 新增通道的时间戳（service 用，避免漏填） */
export function stamps(): { create_time: number; update_time: number } {
  const t = now();
  return { create_time: t, update_time: t };
}
