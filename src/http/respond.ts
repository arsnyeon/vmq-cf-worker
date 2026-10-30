/**
 * 接口响应信封。
 *
 * 全站统一用这一种形状（旧版 PHP 后台就是它，前端 layui 表格直接吃）：
 *
 *   成功：{ code: 1, msg: '保存成功' }
 *   失败：{ code: 0, msg: '金额格式不正确' }
 *   列表：{ code: 0, msg: '', count: 总数, data: [...] }
 *
 * ⚠️ 列表的 code 是 **0**（不是 1）——这是旧版约定，layui 的 table 只认
 *    code===0 表示成功。改这里等于改前端契约，不要动。
 *
 * 新接口（SPA 用的 /api/*）也用同一套信封，前端一个 client 就能解包。
 */
import { json } from '../lib/util';

export interface ApiResult {
  code: 0 | 1;
  msg: string;
  count?: number;
  data?: unknown;
}

/** 成功 */
export function ok(msg = '成功'): ApiResult {
  return { code: 1, msg };
}

/** 成功且带数据 */
export function okData<T>(data: T, msg = '成功', count?: number): ApiResult {
  const r: ApiResult = { code: 1, msg, data };
  if (count !== undefined) r.count = count;
  return r;
}

/** 失败 */
export function fail(msg: string): ApiResult {
  return { code: 0, msg };
}

/** 旧版表格数据格式：code 固定 0，数据在 data 里 */
export function table<T>(rows: T[], count: number): ApiResult {
  return { code: 0, msg: '', count, data: rows };
}

/** 把 ApiResult 直接序列化成 Response */
export function reply(r: ApiResult): Response {
  return json(r);
}

/** 便捷：直接返回成功的 Response */
export function replyOk(msg = '成功'): Response {
  return json(ok(msg));
}

/** 便捷：直接返回失败的 Response */
export function replyFail(msg: string): Response {
  return json(fail(msg));
}

/** 便捷：直接返回表格 Response */
export function replyTable<T>(rows: T[], count: number): Response {
  return json(table(rows, count));
}

/** code 为 1 表示成功 */
export function isOk(r: ApiResult): boolean {
  return r.code === 1;
}
