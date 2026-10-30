/**
 * 订单数据访问。
 *
 * 订单表是收款系统的核心：金额匹配、回调状态、补单都读它。
 * 这里只负责 SQL，不含业务判断。
 */
import type { OrderRow } from '../../lib/db';
import { like, marks } from '../shared/sql';

export interface OrderListFilter {
  status?: number;
  /** 支付方式：1 微信 / 2 支付宝 / 3 QQ / 4 数字人民币 */
  type?: number;
  /** 创建时间范围（unix 秒，含边界） */
  startTs?: number;
  endTs?: number;
  keyword?: string;
  limit: number;
  offset: number;
}

/** 列表页要的列（不要 SELECT * —— orders 有 20+ 列，列表用不到） */
const LIST_COLUMNS =
  'id, pid, order_id, out_trade_no, name, type, money, truemoney, status, create_time, pay_time, notify_attempts';

export interface OrderListRow {
  id: number;
  pid: number;
  order_id: string;
  out_trade_no: string;
  name: string;
  type: number;
  money: string;
  truemoney: string;
  status: number;
  create_time: number;
  pay_time: number;
  notify_attempts: number;
}

export async function list(
  db: D1Database,
  f: OrderListFilter
): Promise<{ rows: OrderListRow[]; count: number }> {
  const where: string[] = [];
  const binds: unknown[] = [];

  if (f.status !== undefined) {
    where.push('status = ?');
    binds.push(f.status);
  }
  if (f.type !== undefined) {
    where.push('type = ?');
    binds.push(f.type);
  }
  if (f.startTs !== undefined) {
    where.push('create_time >= ?');
    binds.push(f.startTs);
  }
  if (f.endTs !== undefined) {
    where.push('create_time <= ?');
    binds.push(f.endTs);
  }
  if (f.keyword) {
    where.push('(order_id LIKE ? OR out_trade_no LIKE ? OR name LIKE ?)');
    const kw = like(f.keyword);
    binds.push(kw, kw, kw);
  }

  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const cnt = await db
    .prepare(`SELECT COUNT(*) AS c FROM orders ${w}`)
    .bind(...binds)
    .first<{ c: number }>();

  const rows = await db
    .prepare(`SELECT ${LIST_COLUMNS} FROM orders ${w} ORDER BY id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, f.limit, f.offset)
    .all<OrderListRow>();

  return { rows: rows.results, count: cnt?.c ?? 0 };
}

export async function findById(db: D1Database, id: number): Promise<OrderRow | null> {
  const row = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRow>();
  return row ?? null;
}

export async function notifyAttempts(db: D1Database, id: number): Promise<number> {
  const row = await db
    .prepare('SELECT notify_attempts FROM orders WHERE id = ?')
    .bind(id)
    .first<{ notify_attempts: number }>();
  return row?.notify_attempts ?? 0;
}

export async function removeMany(db: D1Database, idList: number[]): Promise<number> {
  if (!idList.length) return 0;
  await db
    .prepare(`DELETE FROM orders WHERE id IN (${marks(idList.length)})`)
    .bind(...idList)
    .run();
  return idList.length;
}

/** 各状态订单数（看板用） */
export async function countByStatus(db: D1Database): Promise<Record<string, number>> {
  const r = await db
    .prepare('SELECT status, COUNT(*) AS c FROM orders GROUP BY status')
    .all<{ status: number; c: number }>();
  const out: Record<string, number> = {};
  for (const row of r.results) out[String(row.status)] = row.c;
  return out;
}
