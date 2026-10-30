import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, CreditCard, ShoppingCart, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api, type Stats, type SystemInfo } from '@/lib/api';

/** 两列表格的一行：左标签右值 */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 border-b border-border py-2 text-sm last:border-0">
      <span className="w-24 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-all">{value}</span>
    </div>
  );
}

/** 关于本项目：静态信息，写死在前端（不占接口） */
const ABOUT: Array<{ label: string; value: React.ReactNode }> = [
  { label: '项目名称', value: 'V免签 · Cloudflare Workers 版' },
  {
    label: '仓库地址',
    value: (
      <a
        className="text-primary hover:underline"
        href="https://github.com/im-webb/vmq-cf-worker"
        target="_blank"
        rel="noreferrer"
      >
        github.com/im-webb/vmq-cf-worker
      </a>
    ),
  },
  { label: '开源协议', value: 'MIT' },
  {
    label: '问题反馈',
    value: (
      <a
        className="text-primary hover:underline"
        href="https://github.com/im-webb/vmq-cf-worker/issues"
        target="_blank"
        rel="noreferrer"
      >
        GitHub Issues
      </a>
    ),
  },
  { label: '免责声明', value: '仅供个人学习与自用，请勿用于商业用途' },
];

function Stat({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof Wallet;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-medium tabular-nums">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <Icon className="size-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: async () => (await api.get<Stats>('/stats')).data,
    refetchInterval: 15_000,
  });

  const info = useQuery({
    queryKey: ['system-info'],
    queryFn: async () => (await api.get<SystemInfo>('/system-info')).data,
    staleTime: 60_000,
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">加载中…</p>;
  if (error) return <p className="text-sm text-destructive">看板加载失败：{String(error)}</p>;
  if (!data) return null;

  // 日期、金额、订单数按索引配对；老接口没有 labels 时退化为空表
  const dailyIncome = (data.chartData.labels ?? []).map((day, i) => ({
    day,
    amount: data.chartData.income1[i] ?? 0,
    orders: data.chartData.order1[i] ?? 0,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-medium">概览</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            状态：{data.online ? '监控端在线' : '监控端离线'}
            <span className="mx-2 text-border">|</span>
            每 15 秒自动刷新
          </p>
        </div>
        <a
          href="/"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          打开站点 <ArrowUpRight className="size-3.5" />
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="累计收入" value={`¥ ${data.income1}`} icon={Wallet} />
        <Stat label="今日收入" value={`¥ ${data.income2}`} icon={CreditCard} />
        <Stat label="累计订单" value={String(data.order1)} icon={ShoppingCart} />
        <Stat label="今日订单" value={String(data.order2)} icon={Activity} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>近 7 天收入</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">日期</TableHead>
                  <TableHead className="text-right">收入</TableHead>
                  <TableHead className="pr-5 text-right">订单数</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyIncome.map(({ day, amount, orders }, i) => (
                  <TableRow key={day}>
                    <TableCell className="pl-5 tabular-nums text-muted-foreground">
                      {day}
                      {i === dailyIncome.length - 1 ? (
                        <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-foreground">
                          今天
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      ¥ {amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="pr-5 text-right tabular-nums text-muted-foreground">
                      {orders}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>订单状态</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {[
              ['待支付', data.pending],
              ['已支付', data.paid],
              ['回调失败', data.notifyFailed],
              ['已过期', data.expired],
            ].map(([label, n]) => (
              <div key={String(label)} className="rounded-md bg-muted px-3 py-2">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-base font-medium tabular-nums">{n}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>系统信息</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {info.data ? (
              <>
                <InfoRow label="当前版本" value={info.data.edition} />
                <InfoRow label="站点地址" value={info.data.siteAddress || '—'} />
                <InfoRow label="运行平台" value={info.data.runPlatform} />
                <InfoRow label="数据库" value={info.data.database} />
                <InfoRow
                  label="监控端"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={
                          info.data.monitorOnline
                            ? 'size-1.5 rounded-full bg-emerald-500'
                            : 'size-1.5 rounded-full bg-muted-foreground/40'
                        }
                      />
                      {info.data.monitor}
                    </span>
                  }
                />
                <InfoRow label="静态资源" value={info.data.staticAssets} />
                <InfoRow label="上传限制" value={info.data.uploadLimit} />
                <InfoRow label="回调判定" value={info.data.notifyJudge} />
                <InfoRow label="回调重试" value={info.data.notifyRetry} />
              </>
            ) : (
              <p className="py-4 text-sm text-muted-foreground">加载中…</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>关于本项目</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {ABOUT.map((row) => (
              <InfoRow key={row.label} label={row.label} value={row.value} />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
