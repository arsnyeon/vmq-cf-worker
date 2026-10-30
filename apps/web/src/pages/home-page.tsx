import {
  ArrowRight,
  BookOpen,
  Braces,
  Check,
  ChevronRight,
  Code2,
  CreditCard,
  SearchCheck,
  Webhook,
  type LucideIcon,
} from 'lucide-react';
import { SiteLayout } from '@/components/site-layout';
import { Button } from '@/components/ui/button';
import { getSiteSettings } from '@/lib/site';

const flow = [
  { title: '创建订单', detail: 'POST /api/order/create' },
  { title: '用户支付', detail: '跳转收银台完成付款' },
  { title: '结果通知', detail: 'GET notify_url' },
  { title: '确认状态', detail: 'TRADE_SUCCESS' },
];

const capabilities: Array<{ icon: LucideIcon; title: string; description: string }> = [
  { icon: CreditCard, title: '页面跳转支付', description: '一次请求即可跳转收银台，适合网页与传统服务端应用快速接入。' },
  { icon: Braces, title: 'REST API', description: '返回结构化订单与支付数据，方便自定义收银台和各类应用集成。' },
  { icon: Webhook, title: '支付结果通知', description: '标准签名的异步通知与页面回跳，让商户系统及时确认支付结果。' },
  { icon: SearchCheck, title: '订单状态查询', description: '按平台订单号查询支付状态和实际金额，方便完成订单状态核对。' },
];

const documents = [
  { title: '页面跳转支付', description: '请求参数、签名规则与 Node.js 跳转示例', href: '/doc.html', icon: CreditCard },
  { title: 'API 接口支付', description: 'JSON 下单、响应字段与支付地址', href: '/api.html', icon: Code2 },
  { title: '支付结果通知', description: '异步通知验签与成功响应', href: '/result.html', icon: Webhook },
  { title: '单笔订单查询', description: '订单状态、支付金额与过期时间', href: '/chaorder.html', icon: SearchCheck },
];

/**
 * 卡片走浅色（白底 + 细边框），不再用深色块。
 * 深色版试过 slate-950 和 slate-800 两档，在这套白底 + 蓝色系的页面里都显得压秤 ——
 * hero 背景本身就是极浅的蓝，右边突然一块深色，视线会被拽过去。
 * 现在靠 ring + 阴影从渐变背景上浮起来，步骤用蓝色圆点做视觉锚点。
 */
function PaymentFlow() {
  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute -inset-6 -z-10 rounded-[2rem] bg-blue-100/60 blur-2xl" />
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl shadow-slate-900/[0.07] ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-8">
          <div>
            <p className="m-0 text-sm font-semibold text-slate-900">支付流程</p>
            <p className="mt-1 mb-0 text-xs text-slate-500">清晰的订单状态闭环</p>
          </div>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-100">4 个步骤</span>
        </div>
        <ol className="m-0 list-none px-6 py-3 sm:px-8">
          {flow.map((item, index) => (
            <li key={item.title} className="relative flex gap-4 py-4">
              {index < flow.length - 1 && <span aria-hidden="true" className="absolute left-[15px] top-11 h-8 w-px bg-slate-200" />}
              <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 font-mono text-xs font-semibold text-blue-600 ring-1 ring-blue-100">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-sm font-medium text-slate-900">{item.title}</p>
                <code className="mt-1 block truncate text-xs text-slate-500">{item.detail}</code>
              </div>
              <Check aria-hidden="true" className="mt-1 size-4 text-slate-300" />
            </li>
          ))}
        </ol>
        <div className="border-t border-slate-100 bg-slate-50 px-6 py-4 text-xs text-slate-500 sm:px-8">
          标准 MD5 签名 · 页面与 API 双模式
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { title } = getSiteSettings();
  return (
    <SiteLayout current="home">
      <section className="hero-grid overflow-hidden border-b bg-gradient-to-b from-blue-50/60 to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20 lg:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm">
              <span className="size-1.5 rounded-full bg-blue-600" />
              {title} · 轻量支付基础设施
            </div>
            <h1 className="text-balance m-0 text-4xl font-bold leading-[1.12] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[56px]">
              让支付接入
              <span className="block text-blue-600">简单一点。</span>
            </h1>
            <p className="mt-6 mb-0 max-w-xl text-balance text-base leading-8 text-slate-600 sm:text-lg">
              从创建订单到支付通知，提供页面跳转与 API 两种接入方式，让每一笔订单都有清晰的状态。
            </p>
            <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row">
              <Button asChild size="lg">
                <a href="/doc.html">
                  查看接入文档
                  <ArrowRight />
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="/demo.html">支付体验</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
              {['微信', '支付宝', 'QQ 钱包', '数字人民币'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-blue-600" />
                  {item}
                </span>
              ))}
            </div>
          </div>
          <PaymentFlow />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="quick-start">
        <div className="max-w-2xl">
          <p className="mb-3 text-sm font-semibold text-blue-600">快速开始</p>
          <h2 id="quick-start" className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">三步完成支付接入</h2>
          <p className="mt-4 mb-0 leading-7 text-muted-foreground">沿用熟悉的订单与签名模型，不需要引入复杂的前端框架。</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ['创建订单', '提交商户订单号、金额与支付方式，完成参数签名。', 'POST /api/order/create'],
            ['引导用户支付', '跳转平台收银台，或使用 API 返回的数据构建自己的页面。', '/pay/{orderId}'],
            ['确认支付结果', '在异步通知中验签并处理订单，同时支持主动查询状态。', 'TRADE_SUCCESS'],
          ].map(([title, description, code], index) => (
            <article key={title} className="rounded-2xl border bg-white p-6 shadow-sm shadow-slate-900/[0.03]">
              <span className="font-mono text-sm font-semibold text-blue-600">0{index + 1}</span>
              <h3 className="mb-2 mt-5 text-lg font-semibold">{title}</h3>
              <p className="m-0 min-h-14 text-sm leading-7 text-muted-foreground">{description}</p>
              <code className="mt-5 block rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">{code}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y bg-slate-50/80" aria-labelledby="capabilities">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="max-w-2xl">
            <p className="mb-3 text-sm font-semibold text-blue-600">核心能力</p>
            <h2 id="capabilities" className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">覆盖完整的支付链路</h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <article key={title} className="group rounded-2xl border bg-white p-6 transition-colors hover:border-blue-200 sm:p-7">
                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <Icon className="size-5" />
                </div>
                <h3 className="mb-2 mt-5 text-lg font-semibold">{title}</h3>
                <p className="m-0 text-sm leading-7 text-muted-foreground">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20" aria-labelledby="documents">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-sm font-semibold text-blue-600">开发文档</p>
            <h2 id="documents" className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">需要的说明，都在这里</h2>
          </div>
          <Button asChild variant="ghost">
            <a href="/doc.html">
              查看全部文档
              <ArrowRight />
            </a>
          </Button>
        </div>
        <div className="mt-10 overflow-hidden rounded-2xl border bg-white">
          {documents.map(({ title, description, href, icon: Icon }) => (
            <a key={href} href={href} className="group flex items-center gap-4 border-b p-5 last:border-b-0 hover:bg-blue-50/50 sm:p-6">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{description}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-blue-600" />
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8 sm:pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-blue-600 px-6 py-10 text-white sm:px-10 sm:py-12">
          <div aria-hidden="true" className="absolute -right-16 -top-24 size-64 rounded-full border-[48px] border-white/10" />
          <div className="relative flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">从一个订单开始</h2>
              <p className="mt-3 mb-0 text-sm leading-7 text-blue-100">阅读接入指南，或直接在体验中心创建一笔测试订单。</p>
            </div>
            <div className="flex flex-col gap-3 min-[420px]:flex-row">
              <Button asChild className="bg-white text-blue-700 hover:bg-blue-50">
                <a href="/doc.html">
                  <BookOpen />
                  阅读文档
                </a>
              </Button>
              <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:border-white/50 hover:bg-white/10 hover:text-white">
                <a href="/demo.html">在线体验</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
