/**
 * 图片上传。
 *
 * ⚠️ 这里把图片以 **base64 文本** 存进 D1 的 uploads 表，没有文件系统也没有 R2。
 * D1 单值上限 2,000,000 字节，base64 膨胀 4/3，所以原始文件必须卡在 1.4MB 以内
 * （见 lib/const.ts 的 MAX_UPLOAD_BYTES 说明）。换 R2 后可以放开。
 */
import type { Env } from '../../lib/db';
import type { ApiResult } from '../../http/respond';
import { fail, okData } from '../../http/respond';
import {
  MAX_D1_VALUE_BYTES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  UPLOAD_MIME_LABEL,
} from '../../lib/const';
import { now } from '../../lib/util';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 分块转 base64：2MB 一次性 spread 会爆调用栈 */
function toBase64(bytes: Uint8Array): string {
  let raw = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(raw);
}

export async function saveUpload(env: Env, file: File): Promise<ApiResult> {
  if (file.size > MAX_UPLOAD_BYTES) return fail(`图片不能超过 ${MAX_UPLOAD_LABEL}`);

  const mime = file.type || 'application/octet-stream';
  if (!ALLOWED_MIME.has(mime)) return fail(`只支持 ${UPLOAD_MIME_LABEL}`);

  const buf = await file.arrayBuffer();
  const hash = (await sha256Hex(buf)).slice(0, 24);
  const b64 = toBase64(new Uint8Array(buf));

  // 第二道闸：D1 单个字符串上限 2,000,000 字节。上面按 1.4MB 卡过原始大小，
  // 理论上 base64 后 ~1.87MB 不会超；这里再校验一次，避免以后有人调大上限时静默截断。
  if (b64.length > MAX_D1_VALUE_BYTES) {
    return fail('图片编码后超出数据库单条上限，请压缩后再传');
  }

  await env.DB.prepare(
    'INSERT INTO uploads (hash, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?) ' +
      'ON CONFLICT(hash) DO NOTHING'
  )
    .bind(hash, mime, file.size, b64, now())
    .run();

  return okData({ url: `/upload/${hash}` }, '上传成功');
}
