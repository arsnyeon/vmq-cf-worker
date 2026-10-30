#!/usr/bin/env node
/**
 * 回调成功判定（isSuccessBody）三种模式测试。
 *
 * 覆盖：success 精确匹配 / @any2xx 只看状态码 / @json:字段=值 JSON 匹配。
 * 用例来自真实场景：某商户站点的 /api/verifyPayResult（返回 JSON）
 * 永远返回 HTTP 200 + {"code":1|0,...}，默认 success 模式会每笔都判失败。
 */
import { isSuccessBody, nameToPayType } from '../src/lib/notify.ts';

let bad = 0;
function check(body, expect, want, label) {
  const got = isSuccessBody(body, expect);
  if (got !== want) {
    bad++;
    console.log('FAIL', label, JSON.stringify(body), 'expect=', expect, 'got=', got, 'want=', want);
  }
}

/* ---------- success（默认）：一字不差，不区分大小写 ---------- */
check('success', 'success', true, 'exact');
check('  SUCCESS  ', 'success', true, 'trim + case');
check('ok', 'success', false, 'mismatch');
check('', 'success', false, 'empty');
check('{"code":1,"data":true,"msg":""}', 'success', false, 'merchant json under success mode');
check('success\r\n', 'success', true, 'crlf');

/* ---------- @any2xx：只看 HTTP 状态码（由调用方保证 2xx） ---------- */
check('anything', '@any2xx', true, 'any body');
check('', '@any2xx', true, 'empty body');
check('{"code":0,"msg":"拒绝"}', '@any2xx', true, 'even merchant rejection passes');

/* ---------- @json:code=1：解析 JSON 检查字段 ---------- */
check('{"code":1,"data":true,"msg":""}', '@json:code=1', true, 'merchant success');
check('{"code":1}', '@json:code=1', true, 'minimal');
check('{"code":"1"}', '@json:code=1', true, 'string number matches');
check('{"code":0,"data":false,"msg":"用户不存在"}', '@json:code=1', false, 'merchant rejection');
check('{"code":2}', '@json:code=1', false, 'other code');
check('not json at all', '@json:code=1', false, 'non-json body');
check('{"msg":"no code field"}', '@json:code=1', false, 'missing field');
check('', '@json:code=1', false, 'empty body under json mode');
check('{"data":{"code":1}}', '@json:code=1', false, 'nested not supported');
check('{"code":1}', '@json:code', false, 'malformed spec no =');
check('{"code":1}', '@json:=1', false, 'malformed spec no field');
check('{"code":1}', '@json:code=', false, 'malformed spec no value');
check('{"status":"ok"}', '@json:status=ok', true, 'custom field string');

/* ---------- 长响应体（回归：判定前不能截断） ----------
 * 真实场景：商户成功返回 {"code":1,...,"token":"<几百字符 JWT>"}，
 * 早期实现先把 body 截到 500 字符再 JSON.parse，导致成功必判失败。
 */
{
  const token = 'eyJhbGciOiJSUzI1NiJ9.' + 'x'.repeat(800);
  const longBody = JSON.stringify({ code: 1, data: true, msg: '', token });
  check(longBody, '@json:code=1', true, 'long json body (>500 chars)');
  check(longBody.slice(0, 500), '@json:code=1', false, 'truncated json must not be parsed as valid');
}

/* ---------- nameToPayType：示例页按钮用的是 wxpay/alipay/qqpay/rmbpay ---------- */
for (const [raw, want] of [
  ['wxpay', 1], ['wechat', 1], ['WX', 1],
  ['alipay', 2], ['Ali', 2],
  ['rmbpay', 4], ['rmb', 4], ['dcep', 4],   // rmbpay 来自 index/demo.html 的按钮
  ['qqpay', 3], ['QQ', 3],                  // 原版文档：qqpay:QQ钱包
  ['1', 1], ['4', 4],
  ['', null], ['abc', null],
]) {
  const got = nameToPayType(raw);
  if (got !== want) {
    bad++;
    console.log('FAIL nameToPayType', JSON.stringify(raw), 'got', got, 'want', want);
  }
}

console.log(bad === 0 ? '全部通过（isSuccessBody 三模式 + nameToPayType）' : `失败 ${bad} 个`);
process.exit(bad === 0 ? 0 : 1);
