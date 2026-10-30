import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/page-shell';
import { api, ApiError } from '@/lib/api';

interface ConfigPayload {
  config: Record<string, string>;
  secretSet: Record<string, boolean>;
}

interface ConfigField {
  name: string;
  label: string;
  hint?: string;
  secret?: boolean;
  full?: boolean;
}

interface ConfigGroup {
  id: string;
  title: string;
  fields: ConfigField[];
}

/** 配置分组：按使用场景拆成四组，一组一个 tab、各自独立保存 */
const GROUPS: ConfigGroup[] = [
  {
    id: 'site',
    title: '站点信息',
    fields: [
      { name: 'title', label: '站点名称' },
      { name: 'url', label: '站点地址', hint: '含协议，如 https://pay.example.com' },
      { name: 'resource_url', label: '静态资源地址', hint: '留空用相对路径 /static' },
      { name: 'keywords', label: '关键词' },
      { name: 'description', label: '描述', full: true },
      { name: 'footer', label: '页脚', full: true },
    ],
  },
  {
    id: 'trade',
    title: '交易设置',
    fields: [
      { name: 'order_timeout', label: '订单超时（分钟）' },
      { name: 'home_url', label: '支付完成跳转' },
      { name: 'timeout_url', label: '超时跳转' },
    ],
  },
  {
    id: 'secret',
    title: '密钥管理',
    fields: [
      {
        name: 'key',
        label: '通讯密钥',
        secret: true,
        hint: '监控端 App 里填的就是它',
      },
      {
        name: 'epaykey_ali',
        label: '商户密钥（易支付）',
        secret: true,
        hint: '易支付网关的商户密钥',
      },
      { name: 'epayid_ali', label: '商户 ID' },
      { name: 'epayurl_ali', label: '支付网关地址' },
    ],
  },
  {
    id: 'contact',
    title: '联系方式',
    fields: [
      { name: 'phone', label: '电话' },
      { name: 'qq', label: 'QQ' },
      { name: 'weixin', label: '微信' },
      { name: 'email', label: '邮箱' },
    ],
  },
];

export function ConfigPage() {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});

  const cfg = useQuery({
    queryKey: ['config'],
    queryFn: async () => (await api.get<ConfigPayload>('/config')).data,
  });

  useEffect(() => {
    if (cfg.data?.config) setValues({ ...cfg.data.config });
  }, [cfg.data]);

  const save = useMutation({
    mutationFn: (v: Record<string, string>) => api.put('/config', v),
    onSuccess: (r) => {
      toast.success(r.msg || '已保存');
      void qc.invalidateQueries({ queryKey: ['config'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  /** 只提交当前 tab 的字段；密钥留空不提交（后端也按「留空不改」处理） */
  function submit(g: ConfigGroup) {
    // 连点保护：disabled 要下一帧才生效，同一帧内的重复点击会并发提交
    if (save.isPending) return;
    const body: Record<string, string> = {};
    for (const f of g.fields) {
      const v = (values[f.name] ?? '').trim();
      if (f.secret && !v) continue;
      body[f.name] = v;
    }
    save.mutate(body);
  }

  const secretSet = cfg.data?.secretSet ?? {};

  return (
    <>
      <PageHeader
        title="系统配置"
        description="分组保存，改完点「保存」立即生效；密钥类留空表示保持原值"
        className="mb-4 border-b border-border pb-4"
      />

      <Tabs defaultValue={GROUPS[0]?.id}>
        <TabsList>
          {GROUPS.map((g) => (
            <TabsTrigger key={g.id} value={g.id}>
              {g.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {GROUPS.map((g) => (
          <TabsContent key={g.id} value={g.id}>
            <Card>
              <CardHeader>
                <CardTitle>{g.title}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-3">
                {g.id === 'secret' ? (
                  <p className="col-span-2 rounded-md border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                    密钥只存在服务端，接口不会把原值回传，所以输入框始终是空的。
                    上方标注「已配置」表示该项已有值；留空保存 = 保持不变，填入新值才会覆盖。
                  </p>
                ) : null}
                {g.fields.map((f) => (
                  <div key={f.name} className={f.full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={f.name}>{f.label}</Label>
                      {f.secret ? (
                        secretSet[f.name] ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" /> 已配置
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">未配置</span>
                        )
                      ) : null}
                    </div>
                    {f.secret ? (
                      <PasswordInput
                        id={f.name}
                        autoComplete="new-password"
                        placeholder={
                          secretSet[f.name] ? '已配置，留空保存即保持不变' : '未配置，填入后保存生效'
                        }
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      />
                    ) : (
                      <Input
                        id={f.name}
                        value={values[f.name] ?? ''}
                        onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                      />
                    )}
                    {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
                  </div>
                ))}
              </CardContent>
              <div className="flex items-center gap-3 border-t border-border p-4">
                <Button size="sm" onClick={() => submit(g)} disabled={save.isPending || cfg.isLoading}>
                  <Save /> {save.isPending ? '保存中…' : '保存'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  只提交「{g.title}」这一组，其它设置不受影响
                </p>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

    </>
  );
}
