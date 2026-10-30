import jsQR from 'jsqr';

/**
 * 从图片文件里识别二维码，返回里面的内容（通常是 wxp:// 或 https://qr.alipay.com/…）。
 *
 * 识别不到返回 null —— 调用方负责提示用户换图或用在线工具手动解码。
 * 全部在浏览器里做，图片不出本机：这里只是把用户截图里的收款码地址提出来，
 * 填进「无金额收款码」字段，后端拿到的仍然是文本，跟手动粘贴完全一样。
 */
export async function decodeQrFile(file: File): Promise<string | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;

  try {
    // 太大的图先等比缩到 1600px 以内：解码够用，也避免 getImageData 卡住主线程
    const MAX = 1600;
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // 二维码识别吃对比度：先铺白底，半透明 PNG 不会变成黑底导致识别失败
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    // attemptBoth：白字深底的「反色」二维码也能识别
    const result = jsQR(data, w, h, { inversionAttempts: 'attemptBoth' });
    return result?.data?.trim() || null;
  } finally {
    bitmap.close?.();
  }
}
