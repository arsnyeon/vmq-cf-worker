import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/page-shell';
import { ImageUpload } from '@/components/image-upload';
import { api, ApiError } from '@/lib/api';

interface Profile {
  id: number;
  username: string;
  phone: string;
  email: string;
  head_img: string;
  status: number;
}

export function ProfilePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ phone: '', email: '', head_img: '' });
  const [pw, setPw] = useState({ password: '', password_again: '' });

  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: async () => (await api.get<Profile>('/profile')).data,
  });

  useEffect(() => {
    if (profile.data) {
      setForm({
        phone: profile.data.phone ?? '',
        email: profile.data.email ?? '',
        head_img: profile.data.head_img ?? '',
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => api.put('/profile', form),
    onSuccess: (r) => {
      toast.success(r.msg || '已保存');
      void qc.invalidateQueries({ queryKey: ['profile'] });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '保存失败'),
  });

  const changePw = useMutation({
    mutationFn: () => api.put('/profile/password', pw),
    onSuccess: (r) => {
      toast.success(r.msg || '密码已修改，请重新登录');
      setPw({ password: '', password_again: '' });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : '修改失败'),
  });

  return (
    <>
      <PageHeader
        title="个人资料"
        description="当前登录账号的信息与密码"
        className="mb-4 border-b border-border pb-4"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>账号</Label>
              <Input value={profile.data?.username ?? ''} disabled />
              <p className="text-xs text-muted-foreground">账号名不可修改</p>
            </div>

            <div className="space-y-1.5">
              <Label>头像</Label>
              <ImageUpload
                value={form.head_img}
                onChange={(url) => setForm((f) => ({ ...f, head_img: url }))}
                size="lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">手机</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
            </div>

            <Button onClick={() => {
              if (!save.isPending) save.mutate();
            }} disabled={save.isPending}>
              <Save /> {save.isPending ? '保存中…' : '保存'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>修改密码</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw1">新密码</Label>
              <Input
                id="pw1"
                type="password"
                autoComplete="new-password"
                value={pw.password}
                onChange={(e) => setPw((p) => ({ ...p, password: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">至少 6 位</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw2">确认新密码</Label>
              <Input
                id="pw2"
                type="password"
                autoComplete="new-password"
                value={pw.password_again}
                onChange={(e) => setPw((p) => ({ ...p, password_again: e.target.value }))}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => changePw.mutate()}
              disabled={changePw.isPending || !pw.password}
            >
              <KeyRound /> {changePw.isPending ? '提交中…' : '修改密码'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
