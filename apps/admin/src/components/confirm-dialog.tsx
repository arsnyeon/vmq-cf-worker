import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * 二次确认。危险操作（删除/补单）统一走它，
 * 避免写一堆 window.confirm —— 后者在移动端和样式上都不受控。
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  destructive = false,
  busy = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            取消
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? '处理中…' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 受控开关：把「确认框 + 待执行动作」收在一处 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    destructive?: boolean;
    action?: () => void | Promise<void>;
  }>({ open: false, title: '' });

  function ask(opts: {
    title: string;
    description?: string;
    confirmText?: string;
    destructive?: boolean;
    action: () => void | Promise<void>;
  }) {
    setState({ open: true, ...opts });
  }

  function close() {
    setState((s) => ({ ...s, open: false }));
  }

  return { state, ask, close, setState };
}
