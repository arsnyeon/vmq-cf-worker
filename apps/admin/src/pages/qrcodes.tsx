import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyRow, PageHeader, Panel, Pagination, Toolbar } from '@/components/page-shell';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { QrCodeField } from '@/components/qr-code-field';
import { api, ApiError } from '@/lib/api';

interface QrcodeRow {
  id: number;
  pid: number;
  money: string;
  ewm: string;
  status: number;
  create_time: string;
}
interface PassageOption {
  id: number;
  type: string;
  remarks: string;
}

interface FormState {
  id: number;
  pid: string;
  money: string;
  ewm: string;
  status: string;
}

const EMPTY: FormState = { id: 0, pid: '', money: '', ewm: '', status: '1' };
const LIMIT = 20;

function isImageUrl(v: string) {
  return /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?|$)/i.test(v) || v.startsWith('data:');
}
function qrSrc(v: string) {
  return isImageUrl(v) ? v : `/enQrcode?url=${encodeURIComponent(v)}&size=10`;
}

export function QrcodesPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; action?: () => Promise<void> }>({
    open: false,
    title: '',
  });

  const list = useQuery({
    queryKey: ['qrcodes', page],
    queryFn: async () => {
      const r = await api.get<QrcodeRow[]>(`/qrcodes?page=${page}&limit=${LIMIT}`);
      return { rows: r.data ?? [], count: r.count ?? 0 };
    },
  });

  const options = useQuery({
    queryKey: ['passage-options'],
    queryFn: async () => (await api.get<PassageOption[]>('/passages/options')).data ?? [],
    staleTime: 60_000,
  });

  const save = useMutation({
    mutationFn: (f: FormState) => {
      const body = { pid: f.pid, money: f.money, ewm: f.ewm, status: f.status };
      return f.id ? api.put(`/qrcodes/${f.id}`, body) : api.post('/qrcodes', body);
    },
    onSuccess: (r) => {
      toast.success(r.msg || '已保存');
      setForm(null);
      void qc.invalidateQueries({ queryKey: ['qrcodes'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: number; status: number }) =>
      api.patch(`/qrcodes/${v.id}/status`, { status: v.status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['qrcodes'] }),
  });

  const remove = useMutation({
    mutationFn: (ids: number[]) => api.del('/qrcodes', { ids }),
    onSuccess: (r) => {
      toast.success(r.msg || '已删除');
      setSelected([]);
      void qc.invalidateQueries({ queryKey: ['qrcodes'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '删除失败'),
  });

  const rows = list.data?.rows ?? [];
  const count = list.data?.count ?? 0;
  const optLabel = (pid: number) => {
    const o = (options.data ?? []).find((x) => x.id === pid);
    return o ? `#${o.id} ${o.type}${o.remarks ? ` · ${o.remarks}` : ''}` : `#${pid}`;
  };

  return (
    <>
      <PageHeader
        title="固定金额码"
        description="给通道准备固定金额的收款码，下单时按金额精确命中"
        className="mb-4 border-b border-border pb-4"
      />

      <Toolbar>
        <Button size="sm" onClick={() => setForm({ ...EMPTY, pid: String(options.data?.[0]?.id ?? '') })}>
          <Plus /> 新增
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void qc.invalidateQueries({ queryKey: ['qrcodes'] })}
        >
          <RefreshCw className={list.isFetching ? 'animate-spin' : ''} /> 刷新
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={!selected.length}
          title={selected.length ? undefined : '先在下方列表勾选要删除的记录'}
          onClick={() =>
            setConfirm({
              open: true,
              title: `批量删除 ${selected.length} 条？`,
              action: async () => {
                await remove.mutateAsync(selected);
              },
            })
          }
        >
          <Trash2 /> 批量删除{selected.length ? ` (${selected.length})` : ''}
        </Button>
      </Toolbar>

      <Panel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && selected.length === rows.length}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                  aria-label="全选"
                />
              </TableHead>
              <TableHead className="w-12">ID</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>所属通道</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>创建时间</TableHead>
              <TableHead className="sticky right-0 z-10 w-32 border-b border-l border-border bg-card text-right shadow-[-6px_0_8px_-8px_rgba(0,0,0,0.15)]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <EmptyRow colSpan={7} text="加载中…" />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={7} text="还没有固定金额码" />
            ) : (
              rows.map((r) => (
                <TableRow key={r.id} className="group">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(r.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, r.id] : prev.filter((x) => x !== r.id)
                        )
                      }
                      aria-label={`选择 ${r.id}`}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{r.id}</TableCell>
                  <TableCell className="tabular-nums">¥{r.money}</TableCell>
                  <TableCell className="text-sm">{optLabel(r.pid)}</TableCell>
                  <TableCell>
                    {r.status === 1 ? (
                      <Badge variant="success">启用</Badge>
                    ) : (
                      <Badge variant="muted">停用</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.create_time}</TableCell>
                  <TableCell className="sticky right-0 z-10 border-l border-border bg-card text-right shadow-[-6px_0_8px_-8px_rgba(0,0,0,0.15)] group-hover:bg-muted">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setForm({
                            id: r.id,
                            pid: String(r.pid),
                            money: r.money,
                            ewm: r.ewm,
                            status: String(r.status),
                          })
                        }
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggle.mutate({ id: r.id, status: r.status === 1 ? 0 : 1 })}
                      >
                        {r.status === 1 ? '停用' : '启用'}
                      </Button>
                      <a
                        href={qrSrc(r.ewm)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-accent"
                      >
                        码
                      </a>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination page={page} limit={LIMIT} count={count} onPage={setPage} />
      </Panel>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? `编辑固定金额码 #${form.id}` : '新增固定金额码'}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>
                    所属通道 <span className="text-destructive">*</span>
                  </Label>
                  <Select value={form.pid} onValueChange={(v) => setForm({ ...form, pid: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择通道" />
                    </SelectTrigger>
                    <SelectContent>
                      {(options.data ?? []).map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {`通道 #${o.id} · ${o.type}${o.remarks ? ` · ${o.remarks}` : ''}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">下单时按「通道 + 金额」精确命中。</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="money">
                    固定金额 <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="money"
                    inputMode="decimal"
                    placeholder="请输入固定金额，如 18.00"
                    value={form.money}
                    onChange={(e) => setForm({ ...form, money: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">最多两位小数，例如 18 或 18.50。</p>
                </div>
              </div>

              <QrCodeField
                id="ewm"
                label="收款码地址"
                required
                value={form.ewm}
                onChange={(v) => setForm({ ...form, ewm: v })}
                placeholder="上传图片自动解码，或直接粘贴 wxp://… / https://qr.alipay.com/…"
                hint="上传收款码截图会解码成地址存起来；解码失败可到 cli.im/deqr 手动解码后粘贴。"
              />

              <div className="space-y-1.5">
                <Label>
                  状态 <span className="text-destructive">*</span>
                </Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">启用</SelectItem>
                    <SelectItem value="0">停用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!form || save.isPending) return;
                save.mutate(form);
              }}
              disabled={save.isPending}
            >
              {save.isPending ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        destructive
        busy={remove.isPending}
        onOpenChange={(v) => setConfirm((c) => ({ ...c, open: v }))}
        onConfirm={async () => {
          try {
            await confirm.action?.();
            setConfirm((c) => ({ ...c, open: false }));
          } catch (e) {
            toast.error(e instanceof ApiError ? e.message : '操作失败');
          }
        }}
      />
    </>
  );
}
