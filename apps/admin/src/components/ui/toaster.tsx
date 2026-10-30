import { Toaster as Sonner } from 'sonner';

/**
 * 全局操作反馈。放在 App 根部，页面里直接 `import { toast } from 'sonner'`。
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            'rounded-lg border border-border bg-card text-foreground text-sm shadow-md',
          description: 'text-muted-foreground',
        },
      }}
    />
  );
}
