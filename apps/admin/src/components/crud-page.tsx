/**
 * 通用列表 + 弹窗表单。
 *
 * 管理员这类域是同一形状（列表 + 增改删 + 启停），
 * 差异只在字段和列，所以用一个声明式骨架承载，页面只写配置。
 *
 * 不追求覆盖所有场景：菜单（动态下拉+树形缩进）、配置（单个表单）、
 * 日志（只读+按天清理）各自单独写，硬塞进来只会变得难读。
 */
import { useState, type ReactNode } from 'react';
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
import { api, ApiError } from '@/lib/api';

export type Field =
  | {
      name: string;
      label: string;
      type?: 'text' | 'number' | 'textarea' | 'password';
      placeholder?: string;
      hint?: string;
      full?: boolean;
    }
  | {
      name: string;
      label: string;
      type: 'select';
      options: Array<{ value: string; label: string }>;
      hint?: string;
      full?: boolean;
    };

export interface Column<T> {
  key: string;
  label: string;
  className?: string;
  render?: (row: T) => ReactNode;
}

export interface CrudConfig<T extends { id: number }> {
  title: string;
  description?: string;
  /** e.g. '/admins' */
  endpoint: string;
  columns: Column<T>[];
  fields: Field[];
  /** 新增时的初值 */
  empty: Record<string, string>;
  /** 行 → 表单值 */
  toForm: (row: T) => Record<string, string>;
  /** 显示启停开关（调 PATCH /endpoint/:id/status） */
  statusKey?: string;
  pageSize?: number;
}

export function CrudPage<T extends { id: number }>({ config }: { config: CrudConfig<T> }) {
  const qc = useQueryClient();
  const size = config.pageSize ?? 20;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [form, setForm] = useState<Record<string, string> | null>(null);
  const [editId, setEditId] = useState(0);
  const [confirm, setConfirm] = useState<{ open: boolean; title: string; action?: () => Promise<void> }>({
    open: false,
    title: '',
  });

  const list = useQuery({
    queryKey: [config.endpoint, page],
    queryFn: async () => {
      const r = await api.get<T[]>(`${config.endpoint}?page=${page}&limit=${size}`);
      return { rows: r.data ?? [], count: r.count ?? 0 };
    },
  });

  const key = [config.endpoint];
  const save = useMutation({
    mutationFn: (v: { id: number; data: Record<string, string> }) =>
      v.id ? api.put(`${config.endpoint}/${v.id}`, v.data) : api.post(config.endpoint, v.data),
    onSuccess: (r) => {
      toast.success(r.msg || '已保存');
      setForm(null);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const remove = useMutation({
    mutationFn: (ids: number[]) => api.del(config.endpoint, { ids }),
    onSuccess: (r) => {
      toast.success(r.msg || '已删除');
      setSelected([]);
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '删除失败'),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: number; status: number }) =>
      api.patch(`${config.endpoint}/${v.id}/status`, { status: v.status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: key }),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '操作失败'),
  });

  const rows = list.data?.rows ?? [];
  const count = list.data?.count ?? 0;
  const colCount = config.columns.length + 2;

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        className="mb-4 border-b border-border pb-4"
      />

      <Toolbar>
        <Button
          size="sm"
          onClick={() => {
            setEditId(0);
            setForm({ ...config.empty });
          }}
        >
          <Plus /> 新增
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void qc.invalidateQueries({ queryKey: key })}
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
              {config.columns.map((c) => (
                <TableHead key={c.key} className={c.className}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead className="sticky right-0 z-10 w-32 border-b border-l border-border bg-card text-right shadow-[-6px_0_8px_-8px_rgba(0,0,0,0.15)]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.isLoading ? (
              <EmptyRow colSpan={colCount} text="加载中…" />
            ) : list.error ? (
              <EmptyRow colSpan={colCount} text={`加载失败：${String(list.error)}`} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={colCount} />
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="group">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.id)}
                      onChange={(e) =>
                        setSelected((prev) =>
                          e.target.checked ? [...prev, row.id] : prev.filter((x) => x !== row.id)
                        )
                      }
                      aria-label={`选择 ${row.id}`}
                    />
                  </TableCell>
                  {config.columns.map((c) => (
                    <TableCell key={c.key} className={c.className}>
                      {c.render
                        ? c.render(row)
                        : String((row as unknown as Record<string, unknown>)[c.key] ?? '') || '—'}
                    </TableCell>
                  ))}
                  <TableCell className="sticky right-0 z-10 border-l border-border bg-card text-right shadow-[-6px_0_8px_-8px_rgba(0,0,0,0.15)] group-hover:bg-muted">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditId(row.id);
                          setForm(config.toForm(row));
                        }}
                      >
                        编辑
                      </Button>
                      {config.statusKey ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            toggle.mutate({
                              id: row.id,
                              status: Number((row as unknown as Record<string, unknown>)[config.statusKey!]) === 1 ? 0 : 1,
                            })
                          }
                        >
                          {Number((row as unknown as Record<string, unknown>)[config.statusKey!]) === 1
                            ? '停用'
                            : '启用'}
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <Pagination page={page} limit={size} count={count} onPage={setPage} />
      </Panel>

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? `编辑 #${editId}` : '新增'}</DialogTitle>
          </DialogHeader>
          {form ? (
            <div className="grid grid-cols-2 gap-3">
              {config.fields.map((f) => (
                <div key={f.name} className={f.full ? 'col-span-2 space-y-1.5' : 'space-y-1.5'}>
                  <Label htmlFor={f.name}>{f.label}</Label>
                  {f.type === 'select' ? (
                    <Select
                      value={form[f.name] ?? ''}
                      onValueChange={(v) => setForm({ ...form, [f.name]: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择" />
                      </SelectTrigger>
                      <SelectContent>
                        {f.options.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : f.type === 'textarea' ? (
                    <textarea
                      id={f.name}
                      className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder={f.placeholder}
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  ) : (
                    <Input
                      id={f.name}
                      type={f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : 'text'}
                      placeholder={f.placeholder}
                      value={form[f.name] ?? ''}
                      onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                  {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
                </div>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!form || save.isPending) return;
                save.mutate({ id: editId, data: form });
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

/** 状态小徽标（列表里复用） */
export function StatusBadge({ value }: { value: number }) {
  return value === 1 ? <Badge variant="success">启用</Badge> : <Badge variant="muted">停用</Badge>;
}
