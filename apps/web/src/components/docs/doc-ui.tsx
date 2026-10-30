import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface DocParameter {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  example: string;
  description: string;
}

export function CopyButton({ value }: { value: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
    window.setTimeout(() => setStatus('idle'), 1800);
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={copy}
      className="shrink-0"
      aria-label={status === 'copied' ? '已复制' : '复制'}
    >
      {status === 'copied' ? <Check /> : <Copy />}
      {status === 'copied' ? '已复制' : status === 'failed' ? '复制失败' : '复制'}
    </Button>
  );
}

export function Endpoint({ method, value }: { method: 'GET' | 'POST'; value: string }) {
  return (
    <div className="mt-7 flex min-w-0 items-center gap-2 rounded-xl border bg-slate-50 p-2 pl-3 sm:gap-3 sm:p-3 sm:pl-4">
      <span className={cn(
        'shrink-0 rounded-md px-2.5 py-1 font-mono text-xs font-bold',
        method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
      )}>
        {method}
      </span>
      <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-xs text-slate-700 sm:text-sm">{value}</code>
      <CopyButton value={value} />
    </div>
  );
}

export function DocSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24">
      <h2 className="m-0 border-b pb-4 text-xl font-bold tracking-tight">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function ParamTable({ params, caption, showRequired = true }: { params: DocParameter[]; caption: string; showRequired?: boolean }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[780px] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th className="px-4 py-3">参数名</th>
            <th className="px-4 py-3">字段名</th>
            <th className="px-4 py-3">类型</th>
            {showRequired && <th className="whitespace-nowrap px-4 py-3">必填</th>}
            <th className="px-4 py-3">示例值</th>
            <th className="px-4 py-3">描述</th>
          </tr>
        </thead>
        <tbody>
          {params.map((param) => (
            <tr key={param.name} className="border-t align-top">
              <td className="px-4 py-4"><code className="font-semibold text-blue-700">{param.name}</code></td>
              <td className="px-4 py-4 text-slate-600">{param.label}</td>
              <td className="px-4 py-4"><code className="text-xs text-slate-500">{param.type}</code></td>
              {showRequired && (
                <td className="whitespace-nowrap px-4 py-4">
                  <span className={param.required === false ? 'text-slate-400' : 'font-medium text-rose-600'}>
                    {param.required === false ? '可选' : '必填'}
                  </span>
                </td>
              )}
              <td className="max-w-52 px-4 py-4"><code className="break-all text-xs text-slate-500">{param.example}</code></td>
              <td className="min-w-52 px-4 py-4 leading-6 text-slate-600">{param.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 代码块用浅色（浅灰标题栏 + 白底代码区）。
 * 原来是 bg-slate-950 的近黑终端风，在整站白底里过于抢眼；
 * 现在靠边框和标题栏分隔，长代码段读起来也不刺眼。
 */
export function CodeBlock({ code, label = 'Node.js' }: { code: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <span className="font-mono text-xs font-semibold text-slate-500">{label}</span>
        <CopyButton value={code} />
      </div>
      <pre className="m-0 overflow-x-auto bg-white p-5 text-[13px] leading-6 text-slate-700"><code>{code}</code></pre>
    </div>
  );
}
