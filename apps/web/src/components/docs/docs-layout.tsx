import { ArrowLeft, ArrowRight, BookOpen, Braces, SearchCheck, Webhook, type LucideIcon } from 'lucide-react';
import { SiteLayout } from '@/components/site-layout';
import { cn } from '@/lib/utils';

export const docNavigation: Array<{ slug: string; title: string; href: string; icon: LucideIcon }> = [
  { slug: 'doc', title: '页面跳转支付', href: '/doc.html', icon: BookOpen },
  { slug: 'api', title: 'API 接口支付', href: '/api.html', icon: Braces },
  { slug: 'result', title: '支付结果通知', href: '/result.html', icon: Webhook },
  { slug: 'chaorder', title: '单笔订单查询', href: '/chaorder.html', icon: SearchCheck },
];

export function DocsLayout({ active, children }: { active: string; children: React.ReactNode }) {
  const index = docNavigation.findIndex((item) => item.slug === active);
  const previous = docNavigation[index - 1];
  const next = docNavigation[index + 1];

  return (
    <SiteLayout current="docs">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <nav aria-label="文档导航" className="flex gap-2 overflow-x-auto border-b py-4 lg:hidden">
          {docNavigation.map(({ slug, title, href }) => (
            <a
              key={slug}
              href={href}
              aria-current={slug === active ? 'page' : undefined}
              className={cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground',
                slug === active && 'bg-accent text-accent-foreground'
              )}
            >
              {title}
            </a>
          ))}
        </nav>
        <div className="grid gap-10 py-10 lg:grid-cols-[210px_minmax(0,1fr)] lg:py-14">
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">接入指南</p>
              <nav aria-label="文档导航" className="grid gap-1">
                {docNavigation.map(({ slug, title, href, icon: Icon }) => (
                  <a
                    key={slug}
                    href={href}
                    aria-current={slug === active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-slate-50 hover:text-foreground',
                      slug === active && 'bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground'
                    )}
                  >
                    <Icon className="size-4" />
                    {title}
                  </a>
                ))}
              </nav>
              <div className="mt-8 rounded-xl bg-slate-50 p-4">
                <p className="m-0 text-sm font-semibold">先跑通一笔订单</p>
                <p className="mb-3 mt-2 text-xs leading-6 text-muted-foreground">使用体验中心确认支付流程，再开始正式接入。</p>
                <a href="/demo.html" className="text-xs font-semibold text-blue-600 hover:text-blue-700">前往支付体验 →</a>
              </div>
            </div>
          </aside>
          <article className="min-w-0 max-w-4xl pb-8">
            {children}
            <nav aria-label="上一篇和下一篇" className="mt-14 grid gap-3 border-t pt-7 sm:grid-cols-2">
              {previous ? (
                <a href={previous.href} className="rounded-xl border p-4 hover:border-blue-300 hover:bg-blue-50/40">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><ArrowLeft className="size-3.5" />上一篇</span>
                  <span className="mt-2 block text-sm font-semibold">{previous.title}</span>
                </a>
              ) : <span className="hidden sm:block" />}
              {next && (
                <a href={next.href} className="rounded-xl border p-4 text-right hover:border-blue-300 hover:bg-blue-50/40">
                  <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground">下一篇<ArrowRight className="size-3.5" /></span>
                  <span className="mt-2 block text-sm font-semibold">{next.title}</span>
                </a>
              )}
            </nav>
          </article>
        </div>
      </div>
    </SiteLayout>
  );
}
