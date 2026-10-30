/**
 * 明暗主题：html.dark 类 + localStorage 记忆 + 跟随系统偏好。
 * 只依赖 document / localStorage，初始化时机见 main.tsx（渲染前先调 initTheme，避免闪白）。
 */
export type Theme = 'light' | 'dark';

const KEY = 'vmq-theme';

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* 隐私模式等场景忽略 */
  }
}

/** 渲染前调用：有记忆用记忆，否则跟系统 */
export function initTheme() {
  const saved = readStoredTheme();
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  applyTheme(saved ?? (prefersDark ? 'dark' : 'light'));
}

export function currentTheme(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function toggleTheme(): Theme {
  const next: Theme = currentTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}
