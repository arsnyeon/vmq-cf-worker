import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Root } from './App';
import { initTheme } from './lib/theme';

// 先于 React 渲染，避免明暗闪烁
initTheme();
import './styles.css';

/**
 * 用 HashRouter 而不是 BrowserRouter：
 * SPA 最终挂在动态路径下（/{后台别名}/app），而构建期无法知道别名，
 * hash 路由不依赖服务端重写，换别名不用重新构建。
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Root />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>
);
