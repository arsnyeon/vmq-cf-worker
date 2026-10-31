import { useRef, useState } from 'react';
import { ImagePlus, Loader2, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadImage } from '@/lib/api';
import { decodeQrFile } from '@/lib/qr-decode';

const MAX_IMG = Math.floor(1.4 * 1024 * 1024);

/** 已经是图片地址（上传后的 /upload/xxx、外链 png、dataURL） */
function isImageUrl(v: string) {
  return /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?|$)/i.test(v) || v.startsWith('data:') || v.startsWith('/upload/');
}
/** 文本 → 现场生成二维码图；图片 → 原样展示 */
function previewSrc(v: string) {
  return isImageUrl(v) ? v : `/enQrcode?url=${encodeURIComponent(v)}&size=10`;
}

/**
 * 收款码输入：文本框 + 上传。
 *
 * 两种上传走两条路，对应后端 `ewm_type` 的两种语义：
 *   · 「上传图片并解码」→ 把二维码里的内容（wxp:// / https://qr.alipay.com/…）填进文本框
 *   · 「上传为图片」    → 存图片地址本身，支付页原样展示（赞赏码）
 * 没有传 `onImage` 时只保留解码这条路（只存解码后的内容，不落图片地址）。
 */
export function QrCodeField({
  id = 'ewm',
  label,
  required,
  value,
  onChange,
  onImage,
  placeholder,
  hint,
  rows = 3,
}: {
  id?: string;
  label: string;
  required?: boolean;
  value: string;
  onChange: (text: string) => void;
  onImage?: (url: string) => void;
  placeholder?: string;
  hint?: React.ReactNode;
  rows?: number;
}) {
  const qrFileRef = useRef<HTMLInputElement>(null);
  const imgFileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pickQr(file: File) {
    if (file.size > MAX_IMG) {
      toast.error(`图片不能超过 ${(MAX_IMG / 1048576).toFixed(1)}MB`);
      return;
    }
    setBusy(true);
    try {
      const text = await decodeQrFile(file);
      if (!text) {
        toast.error('没识别出二维码，换张更清晰的图，或到 cli.im/deqr 解码后粘贴');
        return;
      }
      onChange(text);
      toast.success('已识别二维码内容并填入');
    } catch {
      toast.error('图片解析失败，请换一张重试');
    } finally {
      setBusy(false);
      if (qrFileRef.current) qrFileRef.current.value = '';
    }
  }

  async function pickImage(file: File) {
    if (file.size > MAX_IMG) {
      toast.error(`图片不能超过 ${(MAX_IMG / 1048576).toFixed(1)}MB`);
      return;
    }
    setBusy(true);
    try {
      const url = await uploadImage(file);
      onImage?.(url);
      toast.success('图片已上传');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
      if (imgFileRef.current) imgFileRef.current.value = '';
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      <textarea
        id={id}
        rows={rows}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => qrFileRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <QrCode />} 上传图片并解码
        </Button>
        {onImage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => imgFileRef.current?.click()}
          >
            <ImagePlus /> 上传为图片
          </Button>
        ) : null}
        {value ? (
          <img
            src={previewSrc(value)}
            alt="收款码预览"
            className="size-16 rounded-md border border-border bg-white object-contain p-1"
          />
        ) : null}
      </div>
      <input
        ref={qrFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pickQr(f);
        }}
      />
      {onImage ? (
        <input
          ref={imgFileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pickImage(f);
          }}
        />
      ) : null}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
