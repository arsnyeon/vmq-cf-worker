/**
 * 通道展示转换。
 *
 * old_type 必须保留数字：模板里用它做 `=== 3` 判断（QQ 钱包走不同分支），
 * 而 type 字段是给列表显示的中文。
 */
import { PAY_CODE_LABEL, PAY_TYPE_LABEL } from '../shared/labels';
import { withTimes } from '../shared/format';
import type { PassageListRow } from './passage.repository';

export function toListRow(r: PassageListRow): Record<string, unknown> {
  return {
    ...withTimes(r, ['create_time']),
    old_type: r.type,
    old_code: r.code,
    type: PAY_TYPE_LABEL[Number(r.type)] ?? String(r.type),
    code: PAY_CODE_LABEL[Number(r.code)] ?? String(r.code),
  };
}
