import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { currentTheme, toggleTheme, type Theme } from '@/lib/theme';

/** 明暗切换：图标表示「点击后会变成什么」 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() =>
    typeof document === 'undefined' ? 'light' : currentTheme()
  );

  // 多标签页/系统偏好变化时同步
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setTheme(currentTheme());
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      onClick={() => setTheme(toggleTheme())}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
}
