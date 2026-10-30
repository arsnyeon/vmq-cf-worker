/**
 * QR 版本选择校验：与参考实现（Python segno）比对自动选择的版本。
 *
 * 为什么不比整个矩阵：
 *   填充码字的写法允许两种（正好字节对齐时，是否再补一个 0x00 终止字节），
 *   两者都能被正确解码，但矩阵会不同。所以矩阵级别的等价性交给
 *   test/qr.decode.mjs（用真实解码器扫回来）来证明，这里只核对版本。
 *
 * 依赖：pip3 install --user segno
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { encodeQr } from '../src/lib/qr.ts';

const CASES = [
  'HELLO',
  '0.12',
  'https://qr.alipay.com/EXAMPLE_DEMO_QR',
  'wxp://EXAMPLE_PAY_CODE',
  'http://p2.example.com/pay/202610241952040353',
  '中文测试·支付',
  'a'.repeat(60),
  'b'.repeat(120),
  'c'.repeat(200),
  'd'.repeat(300),
];

writeFileSync('/tmp/qr_cases.json', JSON.stringify(CASES));
const py = `
import json, segno
cases = json.loads(open('/tmp/qr_cases.json').read())
out = []
for s in cases:
    q = segno.make(s, error='m', mode='byte', boost_error=False, micro=False)
    out.append(q.version)
print(json.dumps(out))
`;
const refs = JSON.parse(
  execFileSync('python3', ['-c', py], { encoding: 'utf8', maxBuffer: 32e6 })
);

let fail = 0;
CASES.forEach((s, i) => {
  const mine = encodeQr(s);
  const label = s.length > 32 ? `${s.slice(0, 29)}...(${s.length})` : s;
  if (mine.version === refs[i]) {
    console.log(`✓ ${label}  v${mine.version} ${mine.size}x${mine.size} mask=${mine.mask}`);
  } else {
    console.log(`✗ ${label}  版本不一致 mine=v${mine.version} ref=v${refs[i]}`);
    fail++;
  }
});

console.log(fail === 0 ? `\n版本选择与 segno 一致（${CASES.length} 组）` : `\n失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
