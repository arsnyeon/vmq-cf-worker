import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiDocPage } from '@/pages/api-doc-page';
import { DemoPage } from '@/pages/demo-page';
import { HomePage } from '@/pages/home-page';
import { apiDoc, pageDoc, queryDoc, resultDoc } from '@/content/docs';
import './styles.css';

const pages: Record<string, ReactNode> = {
  home: <HomePage />,
  doc: <ApiDocPage doc={pageDoc} />,
  api: <ApiDocPage doc={apiDoc} />,
  demo: <DemoPage />,
  result: <ApiDocPage doc={resultDoc} />,
  chaorder: <ApiDocPage doc={queryDoc} />,
};

const root = document.getElementById('root');
if (!root) throw new Error('Missing root element');

createRoot(root).render(
  <StrictMode>{pages[document.body.dataset.page ?? 'home'] ?? <HomePage />}</StrictMode>
);
