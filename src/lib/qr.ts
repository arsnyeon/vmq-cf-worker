/**
 * 纯 TS 的 QR 码编码器（字节模式，纠错等级 M，版本 1–15）。
 *
 * 为什么自己写：
 *   - 支付页必须把 `wxp://...` / `https://qr.alipay.com/...` 转成二维码图片，
 *     原来由 PHP 的 /enQrcode 生成，Workers 里没有等价物。
 *   - 不想调第三方 QR 接口：收款码地址属于敏感信息，且第三方不可用时支付页会白屏。
 *
 * 正确性保证：编码结果与参考实现（Python segno）逐模块比对一致，
 * 见 test/qr.check.mjs。表结构直接从规范取，不靠记忆。
 *
 * 只实现 M 级：支付码在户外/打印场景要能扫，M 级（15% 纠错）足够，
 * 且码点少、扫描更快。需要更强纠错时改 EC_LEVEL 即可（表需另补）。
 */

type BlockGroup = readonly [blocks: number, totalCw: number, dataCw: number];

/** 版本 → 分块结构（纠错等级 M）。来源：ISO/IEC 18004 表 9 */
const BLOCKS_M: Record<number, readonly BlockGroup[]> = {
  1: [[1, 26, 16]],
  2: [[1, 44, 28]],
  3: [[1, 70, 44]],
  4: [[2, 50, 32]],
  5: [[2, 67, 43]],
  6: [[4, 43, 27]],
  7: [[4, 49, 31]],
  8: [
    [2, 60, 38],
    [2, 61, 39],
  ],
  9: [
    [3, 58, 36],
    [2, 59, 37],
  ],
  10: [
    [4, 69, 43],
    [1, 70, 44],
  ],
  11: [
    [1, 80, 50],
    [4, 81, 51],
  ],
  12: [
    [6, 58, 36],
    [2, 59, 37],
  ],
  13: [
    [8, 59, 37],
    [1, 60, 38],
  ],
  14: [
    [4, 64, 40],
    [5, 65, 41],
  ],
  15: [
    [5, 65, 41],
    [5, 66, 42],
  ],
};

/** 对齐图案中心坐标，按版本 1..15 排列 */
const ALIGN: readonly (readonly number[])[] = [
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
  [6, 26, 48, 70],
];

const MAX_VERSION = 15;

/* ============================ GF(256) 与 RS ============================ */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function initGalois() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d; // x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]!;
})();

function gmul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a]! + LOG[b]!]!;
}

/** 生成多项式 (x-α^0)(x-α^1)...(x-α^(n-1))，系数从高次到低次，首项恒为 1 */
function rsGenerator(n: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < n; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = EXP[i]!;
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]!;
      next[j + 1] ^= gmul(poly[j]!, root);
    }
    poly = next;
  }
  return poly;
}

/** 计算 data 的 n 个纠错码字 */
function rsEncode(data: Uint8Array, n: number): Uint8Array {
  const gen = rsGenerator(n);
  const ecc = new Uint8Array(n);
  for (const byte of data) {
    const factor = byte ^ ecc[0]!;
    ecc.copyWithin(0, 1);
    ecc[n - 1] = 0;
    if (factor !== 0) {
      for (let i = 0; i < n; i++) ecc[i] ^= gmul(gen[i + 1]!, factor);
    }
  }
  return ecc;
}

/* ============================ 数据编码 ============================ */

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function dataCapacity(version: number): number {
  let n = 0;
  for (const [blocks, , data] of BLOCKS_M[version]!) n += blocks * data;
  return n;
}

function pickVersion(len: number): number {
  for (let v = 1; v <= MAX_VERSION; v++) {
    const cciBits = v < 10 ? 8 : 16;
    const needBits = 4 + cciBits + len * 8;
    if (needBits <= dataCapacity(v) * 8) return v;
  }
  throw new Error(`内容过长，超出 QR 版本 ${MAX_VERSION}-M 的容量（${len} 字节）`);
}

/** 生成最终交织后的码字序列 */
function buildCodewords(bytes: Uint8Array, version: number): number[] {
  const totalData = dataCapacity(version);
  const bits: number[] = [];

  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };

  push(0b0100, 4); // 字节模式
  push(bytes.length, version < 10 ? 8 : 16);
  for (const b of bytes) push(b, 8);

  // 终止符
  const capBits = totalData * 8;
  const term = Math.min(4, capBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  // 补齐到字节边界
  while (bits.length % 8 !== 0) bits.push(0);

  const dataCw: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0;
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]!;
    dataCw.push(v);
  }
  // 填充码字
  const pads = [0xec, 0x11];
  let p = 0;
  while (dataCw.length < totalData) dataCw.push(pads[p++ % 2]!);

  // 分块
  const groups = BLOCKS_M[version]!;
  const dataBlocks: Uint8Array[] = [];
  const eccBlocks: Uint8Array[] = [];
  let offset = 0;
  for (const [blocks, total, data] of groups) {
    const ecLen = total - data;
    for (let b = 0; b < blocks; b++) {
      const chunk = Uint8Array.from(dataCw.slice(offset, offset + data));
      offset += data;
      dataBlocks.push(chunk);
      eccBlocks.push(rsEncode(chunk, ecLen));
    }
  }

  // 交织数据码字
  const out: number[] = [];
  const maxData = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxData; i++) {
    for (const blk of dataBlocks) if (i < blk.length) out.push(blk[i]!);
  }
  const maxEcc = Math.max(...eccBlocks.map((b) => b.length));
  for (let i = 0; i < maxEcc; i++) {
    for (const blk of eccBlocks) if (i < blk.length) out.push(blk[i]!);
  }
  return out;
}

/* ============================ 矩阵构建 ============================ */

export interface QrMatrix {
  size: number;
  version: number;
  mask: number;
  /** modules[row][col] === true 表示深色 */
  modules: boolean[][];
}

function bchFormat(data: number): number {
  let d = data << 10;
  for (let i = 14; i >= 10; i--) {
    if ((d >>> i) & 1) d ^= 0x537 << (i - 10);
  }
  return ((data << 10) | d) ^ 0x5412;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

/** 在功能图案（含格式信息位）上方的矩阵骨架 */
function buildBase(version: number): { m: boolean[][]; fn: boolean[][] } {
  const size = version * 4 + 17;
  const m: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

  const set = (r: number, c: number, dark: boolean) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    m[r]![c] = dark;
    fn[r]![c] = true;
  };

  // 探测图案 7x7 + 分隔符
  for (const [br, bc] of [
    [0, 0],
    [0, size - 7],
    [size - 7, 0],
  ] as const) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = br + r;
        const cc = bc + c;
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) continue;
        const dark =
          r >= 0 && r <= 6 && c >= 0 && c <= 6
            ? (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4))
            : false;
        set(rr, cc, dark);
      }
    }
  }

  // 定时图案：只画两个探测图案之间的部分（8..size-9），否则会覆盖探测图案
  for (let i = 8; i <= size - 9; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }

  // 对齐图案
  const pos = ALIGN[version - 1]!;
  for (const r of pos) {
    for (const c of pos) {
      // 跳过与探测图案重叠的
      const nearFinder =
        (r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8);
      if (nearFinder) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          set(r + dr, c + dc, dark);
        }
      }
    }
  }

  // 预留格式信息区（内容稍后按掩码写入）
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      set(8, i, false);
      set(i, 8, false);
    }
  }
  set(8, 8, false);
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false);
    set(size - 1 - i, 8, false);
  }
  // 固定深色模块
  set(size - 8, 8, true);

  // 版本信息（v>=7）
  if (version >= 7) {
    let v = version;
    let d = v << 12;
    for (let i = 17; i >= 12; i--) {
      if ((d >>> i) & 1) d ^= 0x1f25 << (i - 12);
    }
    const info = (v << 12) | d;
    for (let i = 0; i < 18; i++) {
      const bit = ((info >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = i % 3;
      set(a, size - 11 + b, bit);
      set(size - 11 + b, a, bit);
    }
  }

  return { m, fn };
}

function placeData(
  m: boolean[][],
  fn: boolean[][],
  codewords: number[],
  mask: number
): void {
  const size = m.length;
  let bitIndex = 0;
  const totalBits = codewords.length * 8;

  const nextBit = (): boolean => {
    if (bitIndex >= totalBits) {
      bitIndex++;
      return false; // 余项位补 0
    }
    const byte = codewords[bitIndex >> 3]!;
    const bit = ((byte >>> (7 - (bitIndex & 7))) & 1) === 1;
    bitIndex++;
    return bit;
  };

  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col--; // 跳过竖向定位线
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const c = col - k;
        if (fn[row]![c]) continue;
        let bit = nextBit();
        if (maskBit(mask, row, c)) bit = !bit;
        m[row]![c] = bit;
      }
    }
    upward = !upward;
  }
}

function writeFormat(m: boolean[][], mask: number): void {
  const size = m.length;
  const bits = bchFormat((0b00 << 3) | mask); // 纠错等级 M = 00

  // 位序与 qrcode.js / segno 一致：bit0 起，同时写入左侧竖列与底部横排
  for (let i = 0; i < 15; i++) {
    const dark = ((bits >>> i) & 1) === 1;
    // 竖列（第 8 列）
    if (i < 6) m[i]![8] = dark;
    else if (i < 8) m[i + 1]![8] = dark;
    else m[size - 15 + i]![8] = dark;

    // 横排（第 8 行）
    if (i < 8) m[8]![size - 1 - i] = dark;
    else if (i < 9) m[8]![7] = dark;
    else m[8]![15 - i - 1] = dark;
  }

  // 固定深色模块
  m[size - 8]![8] = true;
}

function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;

  // 规则 1：连续同色
  for (let i = 0; i < size; i++) {
    let runRow = 1;
    let runCol = 1;
    for (let j = 1; j < size; j++) {
      if (m[i]![j] === m[i]![j - 1]) runRow++;
      else {
        if (runRow >= 5) score += 3 + (runRow - 5);
        runRow = 1;
      }
      if (m[j]![i] === m[j - 1]![i]) runCol++;
      else {
        if (runCol >= 5) score += 3 + (runCol - 5);
        runCol = 1;
      }
    }
    if (runRow >= 5) score += 3 + (runRow - 5);
    if (runCol >= 5) score += 3 + (runCol - 5);
  }

  // 规则 2：2x2 同色块
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = m[r]![c];
      if (v === m[r]![c + 1] && v === m[r + 1]![c] && v === m[r + 1]![c + 1]) score += 3;
    }
  }

  // 规则 3：形似探测图案 1:1:3:1:1
  const pattern = [true, false, true, true, true, false, true];
  const check = (get: (k: number) => boolean, len: number): number => {
    let n = 0;
    for (let i = 0; i + 7 <= len; i++) {
      let ok = true;
      for (let k = 0; k < 7; k++) {
        if (get(i + k) !== pattern[k]) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      // 左侧或右侧需要 4 个浅色（越界视为浅色）
      let lightBefore = true;
      for (let k = 1; k <= 4; k++) if (i - k >= 0 && get(i - k)) lightBefore = false;
      let lightAfter = true;
      for (let k = 0; k < 4; k++) if (i + 7 + k < len && get(i + 7 + k)) lightAfter = false;
      if (lightBefore || lightAfter) n += 40;
    }
    return n;
  };
  for (let i = 0; i < size; i++) {
    score += check((k) => m[i]![k]!, size);
    score += check((k) => m[k]![i]!, size);
  }

  // 规则 4：深浅比例
  let dark = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m[r]![c]) dark++;
  const ratio = (dark * 100) / (size * size);
  score += Math.floor(Math.abs(ratio - 50) / 5) * 10;

  return score;
}

/** 仅供测试：导出功能模块图（true = 功能图案/保留位） */
export function qrFunctionMap(version: number): boolean[][] {
  return buildBase(version).fn;
}

/** 仅供测试：导出交织后的码字，用于与参考实现比对 */
export function qrCodewords(text: string): { version: number; codewords: number[] } {
  const bytes = utf8(text);
  const version = pickVersion(bytes.length);
  return { version, codewords: buildCodewords(bytes, version) };
}

/** 生成二维码矩阵（不含静区） */
export function encodeQr(text: string, forceMask?: number): QrMatrix {
  const bytes = utf8(text);
  const version = pickVersion(bytes.length);
  const codewords = buildCodewords(bytes, version);

  let best: { m: boolean[][]; score: number; mask: number } | null = null;
  for (let mask = 0; mask < 8; mask++) {
    if (forceMask !== undefined && mask !== forceMask) continue;
    const { m, fn } = buildBase(version);
    placeData(m, fn, codewords, mask);
    writeFormat(m, mask);
    const score = penalty(m);
    if (!best || score < best.score) best = { m, score, mask };
  }

  return { size: version * 4 + 17, version, modules: best!.m, mask: best!.mask };
}

/* ============================ 输出 ============================ */

/** 转成 SVG（调试/打印用；页面里用 PNG 更稳妥） */
export function qrSvg(text: string, scale = 6, quiet = 4): string {
  const { size, modules } = encodeQr(text);
  const dim = (size + quiet * 2) * scale;
  let path = '';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (modules[r]![c]) path += `M${(c + quiet) * scale} ${(r + quiet) * scale}h${scale}v${scale}h-${scale}z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dim}" height="${dim}" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * 输出 PNG（1 位灰度）。
 * 用 CompressionStream 做 zlib 压缩 —— Workers 与 Node 18+ 都支持。
 */
export async function qrPng(text: string, scale = 6, quiet = 4): Promise<Uint8Array> {
  const { size, modules } = encodeQr(text);
  const dim = (size + quiet * 2) * scale;
  const stride = Math.ceil(dim / 8);
  const raw = new Uint8Array((stride + 1) * dim); // 每行前面 1 字节 filter type(0)

  for (let y = 0; y < dim; y++) {
    const my = Math.floor(y / scale) - quiet;
    for (let x = 0; x < dim; x++) {
      const mx = Math.floor(x / scale) - quiet;
      const dark = my >= 0 && my < size && mx >= 0 && mx < size && modules[my]![mx];
      if (!dark) raw[y * (stride + 1) + 1 + (x >> 3)]! |= 0x80 >> (x & 7); // 0=黑
    }
  }

  const deflated = await zlibDeflate(raw);

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, dim);
  dv.setUint32(4, dim);
  ihdr[8] = 1; // bit depth
  ihdr[9] = 0; // grayscale
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflated),
    chunk('IEND', new Uint8Array(0)),
  ];
  const total = parts.reduce((n, p) => n + p.length, 0);
  const png = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    png.set(p, off);
    off += p.length;
  }
  return png;
}

/** zlib（deflate）压缩，CompressionStream('deflate') 产出的就是 zlib 格式 */
async function zlibDeflate(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('deflate');
  const writer = cs.writable.getWriter();
  void writer.write(data);
  void writer.close();
  const buf = await new Response(cs.readable).arrayBuffer();
  return new Uint8Array(buf);
}
