import { useEffect, useState, type ReactNode } from 'react';
import { ArrowUpRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSiteSettings } from '@/lib/site';
import { cn } from '@/lib/utils';

type Section = 'home' | 'docs' | 'demo';

/**
 * 站内链接统一带 `.html` 后缀（伪静态）。
 * 路由层同时保留不带后缀的别名（src/routes/site.ts 的 PAGES），
 * 旧链接 /doc 不会 404；但页面上生成的地址一律是规范形式 /doc.html。
 */
const navigation = [
  { label: '首页', href: '/', section: 'home' as const },
  { label: '开发文档', href: '/doc.html', section: 'docs' as const },
  { label: '支付体验', href: '/demo.html', section: 'demo' as const },
];

function Brand() {
  const { title } = getSiteSettings();
  return (
    <a href="/" className="flex items-center gap-2.5 rounded-md font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <svg aria-hidden="true" viewBox="0 0 36 36" className="size-8 shrink-0">
        <rect width="36" height="36" rx="10" fill="#2563eb" />
        <path d="M10 11.5 18 25l8-13.5h-5L18 17l-3-5.5h-5Z" fill="white" />
        <path d="M13 8h10" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="max-w-48 truncate text-[17px]">{title}</span>
    </a>
  );
}

function SiteHeader({ current }: { current: Section }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-border/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8 md:grid md:grid-cols-[1fr_auto_1fr]">
        <Brand />
        <nav aria-label="主导航" className="hidden items-center gap-1 md:flex">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={current === item.section ? 'page' : undefined}
              className={cn(
                'rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                current === item.section && 'bg-accent text-accent-foreground'
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
        {/* 文档页不放「立即接入」：已经站在文档里了，点它只是原地重载。
            外层空 div 保留右列占位 —— md 下是 grid 三列，缺了它导航会整体右移。 */}
        <div className="hidden md:flex md:justify-end">
          {current !== 'docs' && (
            <Button asChild size="sm">
              <a href="/doc.html">
                立即接入
                <ArrowUpRight />
              </a>
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={open ? '关闭导航' : '打开导航'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X /> : <Menu />}
        </Button>
      </div>
      {open && (
        <nav id="mobile-navigation" aria-label="移动端导航" className="border-t bg-white px-5 py-4 md:hidden">
          <div className="mx-auto grid max-w-6xl gap-1">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={current === item.section ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground',
                  current === item.section && 'bg-accent text-accent-foreground'
                )}
              >
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

function SiteFooter() {
  const settings = getSiteSettings();
  const configured = settings.footer.replace(/<[^>]*>/g, '').trim();
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between">
        <p className="m-0">{configured || `Copyright © ${new Date().getFullYear()} ${settings.title}`}</p>
        <div className="flex gap-5">
          <a className="transition-colors hover:text-slate-900" href="/doc.html">开发文档</a>
          <a className="transition-colors hover:text-slate-900" href="/demo.html">支付体验</a>
        </div>
      </div>
    </footer>
  );
}

export function SiteLayout({ current, children }: { current: Section; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader current={current} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
