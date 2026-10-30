import { CodeBlock, DocSection, Endpoint, ParamTable, type DocParameter } from '@/components/docs/doc-ui';
import { DocsLayout } from '@/components/docs/docs-layout';

export interface DocDefinition {
  slug: string;
  eyebrow: string;
  title: string;
  description: string;
  method: 'GET' | 'POST';
  endpoint: string;
  request: DocParameter[];
  response?: DocParameter[];
  responseExample?: string;
  notes: string[];
  code: string;
}

export function ApiDocPage({ doc }: { doc: DocDefinition }) {
  return (
    <DocsLayout active={doc.slug}>
      <header>
        <p className="mb-3 text-sm font-medium text-muted-foreground">开发文档 <span className="mx-2 text-slate-300">/</span> {doc.eyebrow}</p>
        <h1 className="m-0 text-3xl font-bold tracking-[-0.03em] sm:text-4xl">{doc.title}</h1>
        <p className="mt-4 mb-0 max-w-2xl text-base leading-7 text-muted-foreground">{doc.description}</p>
        <Endpoint method={doc.method} value={doc.endpoint} />
      </header>

      <DocSection id="request" title="请求参数">
        <ParamTable params={doc.request} caption={`${doc.title}请求参数`} />
      </DocSection>

      {doc.response && (
        <DocSection id="response" title="响应参数">
          <ParamTable params={doc.response} caption={`${doc.title}响应参数`} showRequired={false} />
        </DocSection>
      )}

      {doc.responseExample && (
        <DocSection id="response-example" title="响应示例">
          <CodeBlock code={doc.responseExample} label="JSON" />
        </DocSection>
      )}

      <DocSection id="notes" title="接入说明">
        <ul className="m-0 grid gap-3 pl-5 text-sm leading-7 text-slate-600 marker:text-blue-500">
          {doc.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      </DocSection>

      <DocSection id="example" title="Node.js 示例">
        <CodeBlock code={doc.code} />
      </DocSection>
    </DocsLayout>
  );
}
