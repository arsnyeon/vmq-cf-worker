/**
 * 订单展示转换。
 *
 * 接口返回的字段名/文案是前端契约（layui 表格列绑定、旧版模板），
 * 所以转换逻辑独立在这里，SAP 上线前两边共用同一份。
 */
import { PAY_TYPE_LABEL } from '../shared/labels';
import { withTimes } from '../shared/format';
import type { OrderListRow } from './order.repository';

/** 列表行 → 接口行 */
export function toListRow(r: OrderListRow): Record<string, unknown> {
  return {
    ...withTimes(r as unknown as Record<string, unknown>, ['create_time', 'pay_time']),
    // trade_no 是旧版模板的字段名（= order_id），保留以免前端改绑定
    trade_no: r.order_id,
    type: PAY_TYPE_LABEL[Number(r.type)] ?? String(r.type),
  };
}
