/**
 * 请求参数解析。
 *
 * 参数来源统一走 lib/util 的 readParams()：它把 query、urlencoded body、
 * multipart、JSON body 合并成一个扁平的 Record<string,string>，
 * 并把 id[]=1&id[]=2 合成 "1,2"。
 *
 * 这里只放"怎么解释这些参数"的规则：分页、筛选、批量 id、字段挑选。
 */

/** 分页参数。limit 上限 200，与旧版一致 */
export interface PageArgs {
  page: number;
  limit: number;
  offset: number;
}

export function pageArgs(p: Record<string, string>): PageArgs {
  const page = Math.max(1, Number(p['page'] ?? 1) || 1);
  const limit = Math.min(200, Math.max(1, Number(p['limit'] ?? 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

/**
 * 取筛选值。
 *
 * 两种写法都认：
 *   search[status]=1  —— 旧后台 layui 的筛选表单
 *   status=1          —— /api/admin/* 这类常规 REST 风格
 */
export function filterVal(p: Record<string, string>, key: string): string {
  return (p[`search[${key}]`] ?? p[key] ?? '').trim();
}

/** LIKE 的通配与转义：用户输入里的 % _ 必须当字面量 */
export function like(v: string): string {
  return `%${v.replace(/[%_]/g, (c) => '\\' + c)}%`;
}

/** 批量 id：id=1,2,3 → [1,2,3]（只保留正整数） */
export function idsOf(p: Record<string, string>): number[] {
  // 旧后台用 id，新 SPA 的 DELETE 用 ids（JSON body { ids: [1,2] } → "1,2"）
  return (p['ids'] ?? p['id'] ?? '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

/** 单值转数字，非法值给默认值 */
export function intVal(p: Record<string, string>, key: string, def = 0): number {
  const n = Number(p[key]);
  return Number.isFinite(n) ? n : def;
}

/** 单值取字符串并 trim */
export function strVal(p: Record<string, string>, key: string, def = ''): string {
  const v = p[key];
  return v === undefined ? def : String(v).trim();
}

/** 从参数里挑出指定列（跳过未传的，用于部分更新） */
export function pick(p: Record<string, string>, cols: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of cols) if (p[c] !== undefined) out[c] = p[c]!;
  return out;
}

/**
 * 这个请求要 JSON 还是 HTML？
 *
 * 旧版 layui 表格用 POST 取数；分页关闭时不会带 page/limit，
 * 所以三个条件任一命中都算"要数据"。
 */
export function wantsJson(p: Record<string, string>, path: string, req?: Request): boolean {
  if (path.endsWith('.json')) return true;
  if (req?.method === 'POST') return true;
  return 'page' in p || 'limit' in p;
}
