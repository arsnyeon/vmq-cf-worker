/**
 * SQL 小工具。
 *
 * 这些是"拼查询片段"的纯函数，不属于 HTTP 层也不属于业务层，
 * 所以单独放，repository 共用一份。
 */

/** LIKE 的通配 + 转义：用户输入里的 % _ 当字面量处理 */
export function like(v: string): string {
  return `%${v.replace(/[%_]/g, (c) => '\\' + c)}%`;
}

/** 生成 IN (?,?,?) 的占位符 */
export function marks(n: number): string {
  return Array.from({ length: n }, () => '?').join(',');
}
