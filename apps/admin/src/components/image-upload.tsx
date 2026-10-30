import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

const MAX = Math.floor(1.4 * 1024 * 1024);
const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp';

/**
 * 图片上传。
 *
 * 上传到 /api/admin/upload → 后端存进 D1 的 uploads 表（base64），返回 /upload/<hash>。
 * 前端只做一次大小预检，真正的限额仍以后端为准（1.4MB / png,jpg,gif,webp）。
 */
export function ImageUpload({
  value,
  onChange,
  size = 'md',
  hint,
}: {
  value: string;
  onChange: (url: string) => void;
  size?: 'md' | 'lg';
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File) {
    if (file.size > MAX) {
      toast.error(`图片不能超过 ${(MAX / 1048576).toFixed(1)}MB`);
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: form,
        credentials: 'same-origin',
      });
      const json = (await res.json()) as { code: number; msg: string; data?: { url: string } };
      if (json.code !== 1 || !json.data?.url) throw new Error(json.msg || '上传失败');
      onChange(json.data.url);
      toast.success('上传成功');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '上传失败');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  const box = size === 'lg' ? 'size-24' : 'size-20';

  return (
    <div className="flex items-start gap-3">
      <div
        className={`${box} relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted`}
      >
        {value ? (
          <>
            <img src={value} alt="预览" className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute right-0.5 top-0.5 rounded-full bg-black/50 p-0.5 text-white"
              aria-label="移除"
            >
              <X className="size-3" />
            </button>
          </>
        ) : (
          <ImagePlus className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="space-y-1.5">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void pick(f);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="animate-spin" /> : <ImagePlus />}
          {busy ? '上传中…' : '上传图片'}
        </Button>
        <p className="text-xs text-muted-foreground">
          {hint ?? 'png/jpg/gif/webp，不超过 1.4MB'}
        </p>
      </div>
    </div>
  );
}

/** 兼容入口：路径可以直接喂给 <img src> */
export function uploadedUrl(url: string) {
  return url.startsWith('/') ? url : url;
}
