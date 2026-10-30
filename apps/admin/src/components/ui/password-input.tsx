import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * 带「小眼睛」的密码框：点一下在明文/密文之间切换。
 *
 * 之所以不用 Input 的 type 属性直接切：浏览器（尤其实在手机上）看到 type 变化
 * 会认为是另一个字段，可能触发自动填充或丢掉已输入的值。
 * 这里只是把 type 在 password / text 之间换，值由 React 受控，不受影响。
 */
export function PasswordInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className={cn('pr-9', className)} {...props} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? '隐藏密码' : '显示密码'}
        title={show ? '隐藏密码' : '显示密码'}
        className="absolute right-1 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
