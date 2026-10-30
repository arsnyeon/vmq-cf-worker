/**
 * 二维码可扫性验证（决定性检查）。
 *
 * 前一个测试（qr.check.mjs）与 segno 逐模块比对，能证明结构正确；
 * 这个测试更进一步：用真正的解码器（zxing-cpp）把图扫回来，
 * 确认内容与输入完全一致 —— 也就是"手机能扫出来"。
 *
 * 依赖（仅测试用，不进运行时）：
 *   pip3 install --user numpy zxing-cpp segno
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { encodeQr, qrPng } from '../src/lib/qr.ts';

const CASES = [
  'https://qr.alipay.com/EXAMPLE_DEMO_QR',
  'wxp://EXAMPLE_PAY_CODE',
  'http://p2.example.com/pay/202610241952040353',
  '0.12',
  'https://merchant.example.com/api/verifyPayResult?out_trade_no=SMOKE20261024195204&trade_status=TRADE_SUCCESS',
  '中文二维码测试·支付宝',
  'x'.repeat(150),
];

/** 生成 PGM（灰度），方便 python 侧直接读 */
function pgm(text, scale = 6, quiet = 4) {
  const { size, modules } = encodeQr(text);
  const dim = (size + quiet * 2) * scale;
  const head = Buffer.from(`P5\n${dim} ${dim}\n255\n`, 'ascii');
  const body = Buffer.alloc(dim * dim, 255);
  for (let y = 0; y < dim; y++) {
    const my = Math.floor(y / scale) - quiet;
    for (let x = 0; x < dim; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const dark = my >= 0 && my < size && mx >= 0 && mx < size && modules[my][mx];
      if (dark) body[y * dim + x] = 0;
    }
  }
  return Buffer.concat([head, body]);
}

const files = [];
CASES.forEach((s, i) => {
  const p = `/tmp/vmq_qr_${i}.pgm`;
  writeFileSync(p, pgm(s));
  files.push(p);
});

const py = `
import json, sys
import numpy as np
import zxingcpp

def read_pgm(path):
    with open(path, 'rb') as f:
        assert f.readline().strip() == b'P5'
        dims = f.readline().split()
        w, h = int(dims[0]), int(dims[1])
        maxv = int(f.readline())
        data = f.read(w * h)
    return np.frombuffer(data, dtype=np.uint8).reshape(h, w)

out = []
for p in ${JSON.stringify(files)}:
    img = read_pgm(p)
    res = zxingcpp.read_barcode(img)
    out.append(None if res is None else res.text)
print(json.dumps(out))
`;

const raw = execFileSync('python3', ['-c', py], { encoding: 'utf8', maxBuffer: 32e6 });
const decoded = JSON.parse(raw);

let fail = 0;
CASES.forEach((s, i) => {
  const got = decoded[i];
  const label = s.length > 32 ? `${s.slice(0, 29)}...(${s.length})` : s;
  if (got === s) {
    console.log(`✓ ${label}`);
  } else if (got === null) {
    console.log(`✗ ${label}  解码失败（扫不出来）`);
    fail++;
  } else {
    console.log(`✗ ${label}  解码结果不符: ${JSON.stringify(got).slice(0, 60)}`);
    fail++;
  }
});

// PNG 能不能被解码器直接读（顺带验证 PNG 编码本身）
const png = await qrPng(CASES[0], 8, 4);
writeFileSync('/tmp/vmq_qr.png', png);
const pngPy = `
import numpy as np, zxingcpp, struct, zlib
data = open('/tmp/vmq_qr.png','rb').read()
# 极简 PNG 解析（仅支持我们生成的 1 位灰度、filter=0）
pos = 8
idat = b''
w = h = 0
while pos < len(data):
    ln = struct.unpack('>I', data[pos:pos+4])[0]
    typ = data[pos+4:pos+8]
    body = data[pos+8:pos+8+ln]
    if typ == b'IHDR':
        w, h, depth, ctype = struct.unpack('>IIBB', body[:10])
    elif typ == b'IDAT':
        idat += body
    pos += 12 + ln
raw = zlib.decompress(idat)
stride = (w + 7) // 8
img = np.full((h, w), 255, dtype=np.uint8)
for y in range(h):
    row = raw[y*(stride+1)+1:(y+1)*(stride+1)]
    for x in range(w):
        if not (row[x >> 3] >> (7 - (x & 7))) & 1:
            img[y, x] = 0
res = zxingcpp.read_barcode(img)
print('PNG_DECODE=' + (res.text if res else 'FAIL'))
print(f'PNG_SIZE={w}x{h}')
`;
const pngOut = execFileSync('python3', ['-c', pngPy], { encoding: 'utf8' });
const pngLine = pngOut.split('\n').find((l) => l.startsWith('PNG_DECODE=')) ?? '';
const pngText = pngLine.replace('PNG_DECODE=', '');
if (pngText === CASES[0]) {
  console.log(`✓ PNG 输出可解码 (${pngOut.trim().split('\n').pop()})`);
} else {
  console.log(`✗ PNG 输出无法解码: ${pngText}`);
  fail++;
}

console.log(fail === 0 ? `\n全部通过（${CASES.length} 组，zxing 解码与输入完全一致）` : `\n失败 ${fail} 项`);
process.exit(fail === 0 ? 0 : 1);
