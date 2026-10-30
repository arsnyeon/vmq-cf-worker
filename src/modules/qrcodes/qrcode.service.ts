/**
 * 固定金额码业务。
 */
import type { Env } from '../../lib/db';
import type { ApiResult } from '../../http/respond';
import { fail, ok, table } from '../../http/respond';
import { filterVal, idsOf, intVal, pageArgs, strVal } from '../../http/request';
import { withTimes } from '../shared/format';
import * as repo from './qrcode.repository';

export async function listQrcodes(env: Env, p: Record<string, string>): Promise<ApiResult> {
  const { limit, offset } = pageArgs(p);
  const pid = filterVal(p, 'pid');
  const status = filterVal(p, 'status');

  const { rows, count } = await repo.list(env.DB, {
    pid: pid === '' ? undefined : Number(pid),
    status: status === '' ? undefined : Number(status),
    limit,
    offset,
  });

  // 只有时间需要格式化，字段名不变，所以不单独抽 presenter
  return table(
    rows.map((r) => withTimes(r as unknown as Record<string, unknown>, ['create_time'])),
    count
  );
}

/** 新增（id=0）或修改 */
export async function saveQrcode(
  env: Env,
  p: Record<string, string>,
  id: number
): Promise<ApiResult> {
  const pid = intVal(p, 'pid');
  const money = strVal(p, 'money');
  const ewm = strVal(p, 'ewm');
  const status = intVal(p, 'status', 1);

  if (!pid) return fail('请选择所属通道');
  if (!/^\d+(\.\d{1,2})?$/.test(money)) return fail('金额格式不正确');
  if (!ewm) return fail('请填写收款码');

  const data = { pid, money, ewm, status };
  if (id) {
    await repo.update(env.DB, id, data);
    return ok('保存成功');
  }
  await repo.insert(env.DB, data);
  return ok('添加成功');
}

export async function setQrcodeStatus(env: Env, p: Record<string, string>): Promise<ApiResult> {
  const id = intVal(p, 'id');
  if (!id) return fail('缺少 id');
  await repo.setStatus(env.DB, id, intVal(p, 'status'));
  return ok('设置成功');
}

export async function removeQrcodes(env: Env, p: Record<string, string>): Promise<ApiResult> {
  const list = idsOf(p);
  if (!list.length) return fail('缺少 id');
  await repo.removeMany(env.DB, list);
  return ok(`已删除 ${list.length} 条`);
}
