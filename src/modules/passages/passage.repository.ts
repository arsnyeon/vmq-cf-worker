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

const LIST_COLUMNS =
  'id, type, code, zf_pid, ewm_type, ewm, balance, succcount, succprice, is_status, status, '
  + 'money_change, pay_qf, create_time, ck_time, run_time, remarks';

export interface PassageListFilter {
  type?: number;
  code?: number;
  status?: number;
  is_status?: number;
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
  for (const k of ['type', 'code', 'status', 'is_status'] as const) {
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

/** 固定金额码页面「所属通道」下拉用 */
export async function listOptions(
  db: D1Database
): Promise<Array<{ id: number; type: number; remarks: string }>> {
  const r = await db
    .prepare('SELECT id, type, remarks FROM passages ORDER BY id ASC')
    .all<{ id: number; type: number; remarks: string }>();
  return r.results;
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
