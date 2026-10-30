/**
 * 通道业务：列表、保存、启停、删除。
 */
import { getConfig, type Env } from '../../lib/db';
import type { ApiResult } from '../../http/respond';
import { fail, ok, table } from '../../http/respond';
import { filterVal, idsOf, intVal, pageArgs } from '../../http/request';
import { dayTs } from '../shared/format';
import { PAY_TYPE_LABEL } from '../shared/labels';
import * as repo from './passage.repository';
import { toListRow } from './passage.presenter';

export async function listPassages(env: Env, p: Record<string, string>): Promise<ApiResult> {
  const { limit, offset } = pageArgs(p);
  const num = (k: 'type' | 'code' | 'status' | 'is_status'): number | undefined => {
    const v = filterVal(p, k);
    return v === '' ? undefined : Number(v);
  };

  const { rows, count } = await repo.list(env.DB, {
    type: num('type'),
    code: num('code'),
    status: num('status'),
    is_status: num('is_status'),
    startTs: dayTs(filterVal(p, 'start')),
    endTs: dayTs(filterVal(p, 'end'), true),
    zfPid: filterVal(p, 'zf_pid') || undefined,
    remarks: filterVal(p, 'remarks') || undefined,
    limit,
    offset,
  });

  // APP 扫码 / 手动配置：监控端绑定要用「域名/通讯密钥/通道id,支付类型」
  // 只有管理员能调这个接口，字符串给前端展示是预期行为（与旧后台一致）
  const appBase = await appConfigBase(env);
  return table(
    rows.map((r) => ({ ...toListRow(r), app_config: `${appBase}${r.id},${r.type}` })),
    count
  );
}

/** 「域名/通讯密钥/」；通讯密钥取值顺序与 appPush 验签一致 */
async function appConfigBase(env: Env): Promise<string> {
  const url = ((await getConfig(env, 'url')) || '').replace(/\/+$/, '');
  const key = (await getConfig(env, 'app_key')) || (await getConfig(env, 'key')) || (await getConfig(env, 'epaykey_ali')) || '';
  return url && key ? `${url}/${key}/` : '';
}

/** 新增（id=0）或修改 */
export async function savePassage(
  env: Env,
  p: Record<string, string>,
  id: number
): Promise<ApiResult> {
  const data = repo.parseFields(p);
  if (data['type'] === undefined) return fail('请选择支付模式');
  if (!data['ewm']) return fail('请填写收款码');

  if (id) {
    data['update_time'] = Math.floor(Date.now() / 1000);
    await repo.update(env.DB, id, data);
    return ok('保存成功');
  }

  const t = repo.stamps();
  await repo.insert(env.DB, { ...data, create_time: t.create_time, update_time: t.update_time });
  return ok('添加成功');
}

export async function setPassageStatus(
  env: Env,
  p: Record<string, string>
): Promise<ApiResult> {
  const id = intVal(p, 'id');
  if (!id) return fail('缺少 id');
  await repo.setStatus(env.DB, id, intVal(p, 'status'));
  return ok('设置成功');
}

export async function removePassages(env: Env, p: Record<string, string>): Promise<ApiResult> {
  const list = idsOf(p);
  if (!list.length) return fail('缺少 id');
  await repo.removeMany(env.DB, list);
  return ok(`已删除 ${list.length} 条`);
}

/** 「所属通道」下拉选项：type 直接给中文支付模式，模板自己拼整句 */
export async function passageOptionRows(
  env: Env
): Promise<Array<{ id: number; type: string; remarks: string }>> {
  const rows = await repo.listOptions(env.DB);
  return rows.map((r) => ({
    id: r.id,
    type: PAY_TYPE_LABEL[Number(r.type)] ?? String(r.type),
    remarks: r.remarks ?? '',
  }));
}
