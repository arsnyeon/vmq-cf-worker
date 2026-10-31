import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { api, ApiError, type Me } from '@/lib/api';
import { Brand } from '@/components/brand';

export function LoginPage({ onLogin }: { onLogin: (me: Me) => void }) {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaKey, setCaptchaKey] = useState(0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post<Me>('/login', { username, password, captcha });
      const me = await api.get<Me>('/me');
      onLogin(me.data);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '登录失败，请重试');
      setCaptcha('');
      // 失败后换一张图（验证码是无状态签名 cookie，旧码到期前仍有效，
      // 这里换图只是给用户一张更清晰的，不是让它失效）
      setCaptchaKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        {/* 只有 LOGO + 「管理后台」，居中；标题/副标题的「登录」文案已去掉 */}
        <CardHeader className="items-center">
          <Brand markClassName="size-7" />
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">账号</Label>
              <Input
                id="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="captcha">验证码</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="captcha"
                  value={captcha}
                  onChange={(e) => setCaptcha(e.target.value)}
                />
                <img
                  key={captchaKey}
                  src="/api/admin/captcha"
                  alt="验证码"
                  className="h-9 w-24 cursor-pointer rounded-md border border-border bg-white object-contain"
                  onClick={() => setCaptchaKey((k) => k + 1)}
                  title="点击换一张"
                />
              </div>
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : null}
              登录
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
