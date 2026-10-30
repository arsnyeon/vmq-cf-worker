import { md5 } from '../src/lib/md5.ts';
import { createHash } from 'node:crypto';

const cases = [
  '', 'a', 'abc', 'message digest', '123456789012345678901234567890',
  '18.00', '1800-1', 'type1price18.00t1792827599pid8',
  '中文测试', '密码', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'a'.repeat(1000),
];
let bad = 0;
for (const s of cases) {
  const got = md5(s);
  const want = createHash('md5').update(Buffer.from(s, 'utf8')).digest('hex');
  if (got !== want) { bad++; console.log('FAIL', JSON.stringify(s).slice(0,30), got, want); }
}
// 随机串
for (let i = 0; i < 300; i++) {
  const n = Math.floor(Math.random() * 300);
  const s = Array.from({length:n}, () => String.fromCharCode(32 + Math.floor(Math.random()*90))).join('');
  const got = md5(s);
  const want = createHash('md5').update(Buffer.from(s,'utf8')).digest('hex');
  if (got !== want) { bad++; console.log('FAIL random len', n, got, want); break; }
}
console.log(bad === 0 ? `全部通过（${cases.length + 300} 个用例）` : `失败 ${bad} 个`);
