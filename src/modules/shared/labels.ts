/**
 * 领域词表：把数字枚举翻译成给人看的文案。
 *
 * 集中放这里的原因：同一套文案会被三处用到 ——
 * 列表接口的 data 字段、页面渲染的下拉选项、新 SPA 的筛选项。
 * 分开放必然漂移（旧版就出现过筛选下拉和列表文案不一致）。
 *
 * ⚠️ 文案与线上历史数据一致，改字等于改前端展示，别顺手"优化"。
 */

/** 支付类型。线上是「微信（wxpay）」这种带英文名的形式，不是「微信」 */
export const PAY_TYPE: Record<number, string> = {
  1: '微信（wxpay）',
  2: '支付宝（alipay）',
  3: 'QQ（qqpay）',
  4: '数字人民币（rmbpay）',
};

export const PAY_TYPE_LABEL = PAY_TYPE;

/** 收款码模式 */
export const PAY_CODE: Record<number, string> = {
  0: '无金额收款码',
  1: '有金额收款码',
  2: '免输入',
};

export const PAY_CODE_LABEL = PAY_CODE;

/** 管理员角色 */
export const ROLES = [
  { id: 1, name: '超级管理员' },
  { id: 2, name: '普通管理员' },
];

/** 「上级菜单」下拉的树形缩进（模板里 |raw 输出，所以带 &nbsp;） */

/**
 * 回调成功判定模式 → 中文短标签（后台首页展示）。
 * 取值说明见 lib/notify.ts：纯文本 / @any2xx / @json:code=1
 */
export function notifyJudgeLabel(v: string): string {
  if (!v || v === 'success') return '纯文本 success';
  if (v === '@any2xx') return '任意 2xx';
  if (v.startsWith('@json:')) {
    const spec = v.slice(6);
    const eq = spec.indexOf('=');
    return eq > 0 ? `JSON ${spec.slice(0, eq)}=${spec.slice(eq + 1)}` : 'JSON（配置异常）';
  }
  return v;
}
