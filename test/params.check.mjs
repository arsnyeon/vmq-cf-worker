#!/usr/bin/env node
/**
 * readParams 参数解析测试。
 *
 * 重点：PHP/jQuery 的数组语法 `id[]=5&id[]=3` 必须合并成 "5,3"。
 * 后台订单管理的「批量删除」就是 `$.post(url, { id: ids })`，
 * 不处理这个语法就会丢掉参数、报「缺少 id」。
 */
import { readParams } from '../src/lib/util.ts';

let bad = 0;
function eq(got, want, label) {
  if (got !== want) {
    bad++;
    console.log('FAIL', label, 'got', JSON.stringify(got), 'want', JSON.stringify(want));
  }
}

// 1) 表单数组语法（jQuery 批量操作）
{
  const req = new Request('https://x.test/admin/order/del', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'id%5B%5D=5&id%5B%5D=3&id%5B%5D=2',
  });
  const p = await readParams(req);
  eq(p['id'], '5,3,2', 'form id[] merge');
}

// 2) 普通单值不受影响
{
  const req = new Request('https://x.test/submit.php', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'pid=1&type=wxpay&money=18.00',
  });
  const p = await readParams(req);
  eq(p['pid'], '1', 'single pid');
  eq(p['type'], 'wxpay', 'single type');
  eq(p['money'], '18.00', 'keep raw money string');
}

// 3) query + body 合并（监控端 GET/POST 都可能）
{
  const req = new Request('https://x.test/appHeart?t=123', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'pid=8&sign=abc',
  });
  const p = await readParams(req);
  eq(p['t'], '123', 'query t');
  eq(p['pid'], '8', 'body pid');
  eq(p['sign'], 'abc', 'body sign');
}

// 4) 逗号分隔的单值（后台另一种写法 { id: '1,2,3' }）
{
  const req = new Request('https://x.test/admin/del', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'id=1%2C2%2C3',
  });
  const p = await readParams(req);
  eq(p['id'], '1,2,3', 'comma string');
}

// 5) JSON body（含数组）
{
  const req = new Request('https://x.test/api/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: [1, 2], name: '测试' }),
  });
  const p = await readParams(req);
  eq(p['id'], '1,2', 'json array');
  eq(p['name'], '测试', 'json string');
}

// 6) multipart/form-data 重复键
{
  const fd = new FormData();
  fd.append('id[]', '7');
  fd.append('id[]', '9');
  fd.append('title', 'hello');
  const req = new Request('https://x.test/upload', { method: 'POST', body: fd });
  const p = await readParams(req);
  eq(p['id'], '7,9', 'multipart id[] merge');
  eq(p['title'], 'hello', 'multipart text');
}

// 7) GET 不带参数
{
  const p = await readParams(new Request('https://x.test/'));
  eq(Object.keys(p).length, 0, 'empty');
}

console.log(bad === 0 ? '全部通过（参数解析 7 组）' : `失败 ${bad} 个`);
process.exit(bad === 0 ? 0 : 1);
