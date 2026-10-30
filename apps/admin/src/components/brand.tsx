/**
 * 品牌标识：与前台（apps/web 的 Brand）保持同一套图形。
 *
 * 前台用的是内联 SVG（不依赖图片资源，任何缩放下都清晰），这里复用同样的
 * viewBox 与路径，保证前后台看到的是同一个 logo。
 * 改图形时两边要一起改；favicon 是同一图形的独立文件
 * （apps/admin/public 与 apps/web/public 下的 favicon.svg）。
 */
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 36 36" className={cn('size-8 shrink-0', className)}>
      <rect width="36" height="36" rx="10" fill="#2563eb" />
      <path d="M10 11.5 18 25l8-13.5h-5L18 17l-3-5.5h-5Z" fill="#ffffff" />
      <path d="M13 8h10" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 图标 + 文字，用于侧边栏顶部、移动端顶栏、登录页 */
export function Brand({
  label = '管理后台',
  className,
  markClassName,
}: {
  label?: string;
  className?: string;
  markClassName?: string;
}) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <BrandMark className={markClassName} />
      <span className="truncate text-sm font-medium tracking-tight">{label}</span>
    </span>
  );
}
