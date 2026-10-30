/**
 * 固定金额收款码数据访问。
 *
 * 与 passages 的区别：passages 是"通道"（一个收款渠道），
 * qrcodes 是给通道准备的"固定金额码"（金额写死，下单时按金额精确命中）。
 */
import { now } from '../../lib/util';
import { marks } from '../shared/sql';

const LIST_COLUMNS = 'q.id, q.pid, q.money, q.ewm, q.status, q.create_time';

export interface QrcodeListFilter {
  pid?: number;
  status?: number;
  limit: number;
  offset: number;
}

export type QrcodeListRow = {
  id: number;
  pid: number;
  money: string;
  ewm: string;
  status: number;
  create_time: number;
};

export async function list(
  db: D1Database,
  f: QrcodeListFilter
): Promise<{ rows: QrcodeListRow[]; count: number }> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (f.pid !== undefined) {
    where.push('q.pid = ?');
    binds.push(f.pid);
  }
  if (f.status !== undefined) {
    where.push('q.status = ?');
    binds.push(f.status);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const cnt = await db
    .prepare(`SELECT COUNT(*) AS c FROM qrcodes q ${w}`)
    .bind(...binds)
    .first<{ c: number }>();

  const rows = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM qrcodes q ${w} ORDER BY q.id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, f.limit, f.offset)
    .all<QrcodeListRow>();

  return { rows: rows.results, count: cnt?.c ?? 0 };
}

export async function findById(
  db: D1Database,
  id: number
): Promise<Record<string, unknown> | null> {
  const row = await db.prepare('SELECT * FROM qrcodes WHERE id = ?').bind(id).first();
  return (row as Record<string, unknown>) ?? null;
}

export interface QrcodeInput {
  pid: number;
  money: string;
  ewm: string;
  status: number;
}

export async function insert(db: D1Database, data: QrcodeInput): Promise<number> {
  const t = now();
  const r = await db
    .prepare(
      'INSERT INTO qrcodes (pid, money, ewm, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .bind(data.pid, data.money, data.ewm, data.status, t, t)
    .run();
  return Number(r.meta.last_row_id ?? 0);
}

export async function update(db: D1Database, id: number, data: QrcodeInput): Promise<void> {
  await db
    .prepare('UPDATE qrcodes SET pid = ?, money = ?, ewm = ?, status = ?, update_time = ? WHERE id = ?')
    .bind(data.pid, data.money, data.ewm, data.status, now(), id)
    .run();
}

export async function removeMany(db: D1Database, idList: number[]): Promise<void> {
  if (!idList.length) return;
  await db
    .prepare(`DELETE FROM qrcodes WHERE id IN (${marks(idList.length)})`)
    .bind(...idList)
    .run();
}

export async function setStatus(db: D1Database, id: number, status: number): Promise<void> {
  await db.prepare('UPDATE qrcodes SET status = ? WHERE id = ?').bind(status, id).run();
}
