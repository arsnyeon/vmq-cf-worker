import { useState } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { SiteLayout } from '@/components/site-layout';
import { Button } from '@/components/ui/button';
import { getSiteSettings } from '@/lib/site';
import { cn } from '@/lib/utils';

const channels = [
  { value: 'wxpay', label: '微信支付', detail: 'WeChat Pay', icon: '/static/web/picture/wx_pay.svg' },
  { value: 'alipay', label: '支付宝', detail: 'Alipay', icon: '/static/web/picture/alipay.svg' },
  { value: 'qqpay', label: 'QQ 钱包', detail: 'QQ Wallet', icon: '/site/images/qqpay-icon.png' },
  { value: 'rmbpay', label: '数字人民币', detail: 'e-CNY', icon: '/static/web/picture/rmbpay.png' },
];

function orderNumber() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${Math.floor(Math.random() * 9000 + 1000)}`;
}

export function DemoPage() {
  const { title } = getSiteSettings();
  const [channel, setChannel] = useState('wxpay');
  const [outTradeNo] = useState(orderNumber);

  return (
    <SiteLayout current="demo">
      <section className="border-b bg-slate-50/70">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
          <p className="mb-3 text-sm font-semibold text-blue-600">支付体验</p>
          <h1 className="m-0 text-3xl font-bold tracking-tight sm:text-4xl">创建一笔测试订单</h1>
          <p className="mt-4 mb-0 max-w-2xl leading-7 text-muted-foreground">选择支付方式并确认金额，体验从下单到平台收银台的完整流程。</p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form action="/demo.html" method="get" className="overflow-hidden rounded-2xl border bg-white shadow-sm shadow-slate-900/[0.04]">
          <div className="flex flex-col gap-2 border-b px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div>
              <p className="m-0 text-sm text-muted-foreground">收款商家</p>
              <p className="mb-0 mt-1 font-semibold">{title}</p>
            </div>
            <div className="sm:text-right">
              <p className="m-0 text-sm text-muted-foreground">订单编号</p>
              <code className="mt-1 block text-xs text-slate-600">{outTradeNo}</code>
            </div>
          </div>

          <input type="hidden" name="type" value={channel} />
          <input type="hidden" name="out_trade_no" value={outTradeNo} />

          <div className="px-6 py-8 sm:px-8">
            <label htmlFor="money" className="text-sm font-semibold">支付金额</label>
            <div className="mt-3 flex items-center rounded-xl border border-input bg-white focus-within:border-blue-400 focus-within:ring-3 focus-within:ring-blue-100">
              <span className="pl-5 text-2xl font-semibold text-slate-400">¥</span>
              <input
                id="money"
                name="money"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue="0.10"
                required
                inputMode="decimal"
                className="min-h-16 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-3 text-3xl font-bold tracking-tight outline-none"
              />
              <span className="pr-5 text-sm text-muted-foreground">元</span>
            </div>
            <p className="mb-0 mt-2 text-xs leading-5 text-muted-foreground">请输入大于 0 的金额，最多保留两位小数。</p>

            <fieldset className="mt-9 border-0 p-0">
              <legend className="mb-4 p-0 text-sm font-semibold">选择支付方式</legend>
              <div role="radiogroup" aria-label="支付方式" className="grid gap-3 sm:grid-cols-2">
                {channels.map(({ value, label, detail, icon }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={channel === value}
                    onClick={() => setChannel(value)}
                    className={cn(
                      'relative flex min-h-20 items-center gap-4 rounded-xl border bg-white px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      channel === value ? 'border-blue-500 bg-blue-50/60 ring-1 ring-blue-500' : 'hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                      <img src={icon} alt="" className="size-8 object-cover object-left" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{label}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{detail}</span>
                    </span>
                    {channel === value && (
                      <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="size-3" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex flex-col gap-4 border-t bg-slate-50/70 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="m-0 text-xs leading-5 text-muted-foreground">体验商品不会发货，请勿用于真实交易。</p>
            <Button type="submit" size="lg" className="w-full sm:w-auto">
              立即支付
              <ArrowRight />
            </Button>
          </div>
        </form>

        <aside className="space-y-5">
          {/* 与首页「支付流程」卡片同一套浅色：白底 + 细边框，避免右侧突然压一块深色 */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-900/[0.03]">
            <p className="m-0 text-sm font-semibold text-slate-900">体验流程</p>
            <ol className="m-0 mt-6 list-none space-y-6 p-0">
              {['确认金额与支付方式', '跳转平台收银台', '完成支付并查看结果'].map((item, index) => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-600">
                  <span className={cn('flex size-7 items-center justify-center rounded-full text-xs font-semibold', index === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}>{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl border bg-blue-50/60 p-6">
            <p className="m-0 text-sm font-semibold text-blue-950">准备正式接入？</p>
            <p className="mb-4 mt-2 text-sm leading-6 text-blue-900/60">查看请求参数和签名示例，在你的系统中创建真实订单。</p>
            <a href="/doc.html" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">阅读开发文档<ArrowRight className="size-4" /></a>
          </div>
        </aside>
      </section>
    </SiteLayout>
  );
}
