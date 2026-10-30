/**
 * 后台菜单数据访问。
 *
 * 菜单是数据驱动的（menus 表），既决定侧边栏渲染，也决定「菜单管理」页的列表，
 * 所以独立成一个 repository，渲染层和管理页共用，避免两处 SQL 漂移。
 */
import { now } from '../../lib/util';

export interface MenuRow {
  id: number;
  pid: number;
  sort: number;
  title: string;
  icon: string;
  href: string;
  target: string;
  remark: string;
  status: number;
}

/** 只取启用中的菜单（渲染侧边栏用） */
export async function listEnabled(db: D1Database): Promise<MenuRow[]> {
  const r = await db
    .prepare(
      'SELECT id, pid, sort, title, icon, href, target, remark, status FROM menus WHERE status = 1 ORDER BY sort ASC, id ASC'
    )
    .all<MenuRow>();
  return r.results;
}

/** 全部菜单（菜单管理页用） */
export async function listAll(db: D1Database): Promise<MenuRow[]> {
  const r = await db
    .prepare(
      'SELECT id, pid, sort, title, icon, href, target, remark, status FROM menus ORDER BY sort ASC, id ASC'
    )
    .all<MenuRow>();
  return r.results;
}

/** 「上级菜单」下拉的原始行，按 id 升序（缩进在展示层算） */
export async function listForParentOptions(
  db: D1Database
): Promise<Array<{ id: number; pid: number; sort: number; title: string }>> {
  const r = await db
    .prepare('SELECT id, pid, sort, title FROM menus ORDER BY id ASC')
    .all<{ id: number; pid: number; sort: number; title: string }>();
  return r.results;
}

export async function findById(db: D1Database, id: number): Promise<MenuRow | null> {
  const row = await db.prepare('SELECT * FROM menus WHERE id = ?').bind(id).first<MenuRow>();
  return row ?? null;
}

export interface MenuInput {
  pid: number;
  sort: number;
  title: string;
  icon: string;
  href: string;
  target: string;
  remark: string;
}

export async function insert(db: D1Database, data: MenuInput): Promise<number> {
  // 菜单 id 是手工维护的有序值（不是自增语义），沿用旧版：取 MAX(id)+1
  const next = await db
    .prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM menus')
    .first<{ n: number }>();
  const id = next?.n ?? 1;
  await db
    .prepare(
      'INSERT INTO menus (id, pid, sort, title, icon, href, target, remark, status, create_time, update_time) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)'
    )
    .bind(
      id,
      data.pid,
      data.sort,
      data.title,
      data.icon,
      data.href,
      data.target,
      data.remark,
      now(),
      now()
    )
    .run();
  return id;
}

export async function update(db: D1Database, id: number, data: MenuInput): Promise<void> {
  await db
    .prepare(
      'UPDATE menus SET pid = ?, sort = ?, title = ?, icon = ?, href = ?, target = ?, remark = ?, update_time = ? WHERE id = ?'
    )
    .bind(
      data.pid,
      data.sort,
      data.title,
      data.icon,
      data.href,
      data.target,
      data.remark,
      now(),
      id
    )
    .run();
}

export async function removeMany(db: D1Database, idList: number[]): Promise<void> {
  if (!idList.length) return;
  const marks = idList.map(() => '?').join(',');
  await db
    .prepare(`DELETE FROM menus WHERE id IN (${marks})`)
    .bind(...idList)
    .run();
}

export async function setStatus(db: D1Database, id: number, status: number): Promise<void> {
  await db.prepare('UPDATE menus SET status = ? WHERE id = ?').bind(status, id).run();
}

export async function setSort(db: D1Database, id: number, value: number): Promise<void> {
  await db.prepare('UPDATE menus SET sort = ? WHERE id = ?').bind(value, id).run();
}
