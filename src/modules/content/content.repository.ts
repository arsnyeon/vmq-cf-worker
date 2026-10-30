/**
 * 内容类数据访问：快捷入口 / 公告 / 操作日志。
 *
 * 三者都是"轻量 CRUD"，结构几乎一样，所以放一个文件分三段，
 * 而不是三个几乎重复的 repository。
 */
import { now } from '../../lib/util';
import { marks } from '../shared/sql';

/* ============================ 操作日志 ============================ */

export async function listLogs(
  db: D1Database,
  filter: { uid?: number; limit: number; offset: number }
): Promise<{ rows: Record<string, unknown>[]; count: number }> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (filter.uid !== undefined) {
    where.push('l.uid = ?');
    binds.push(filter.uid);
  }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const from = 'logs l LEFT JOIN admins a ON a.id = l.uid';

  const cnt = await db
    .prepare(`SELECT COUNT(*) AS c FROM ${from} ${w}`)
    .bind(...binds)
    .first<{ c: number }>();

  const rows = await db
    .prepare(
      `SELECT l.id, l.uid, l.content, l.ip, l.create_time, COALESCE(a.username, "系统") AS username ` +
        `FROM ${from} ${w} ORDER BY l.id DESC LIMIT ? OFFSET ?`
    )
    .bind(...binds, filter.limit, filter.offset)
    .all<Record<string, unknown>>();

  return { rows: rows.results, count: cnt?.c ?? 0 };
}

/** 写一条操作日志。失败不影响主流程（日志不是关键路径） */
export async function addLog(
  db: D1Database,
  uid: number,
  content: string,
  ip: string
): Promise<void> {
  try {
    await db
      .prepare('INSERT INTO logs (uid, content, ip, create_time) VALUES (?, ?, ?, ?)')
      .bind(uid, content, ip, now())
      .run();
  } catch {
    /* 忽略 */
  }
}

export async function removeLogs(db: D1Database, idList: number[]): Promise<void> {
  if (!idList.length) return;
  await db
    .prepare(`DELETE FROM logs WHERE id IN (${marks(idList.length)})`)
    .bind(...idList)
    .run();
}

/** 清理 N 天前的日志，返回删除条数 */
export async function removeLogsBefore(db: D1Database, days: number): Promise<number> {
  const before = now() - days * 86400;
  const r = await db.prepare('DELETE FROM logs WHERE create_time < ?').bind(before).run();
  return r.meta.changes ?? 0;
}
