import { PageHeader } from '@/components/page-header';
import { listProviders } from '@/lib/services/provider';
import {
  PROVIDER_TOOL_CATALOGS,
  SURFACE_LABELS,
  formatToolBilling,
  type ProviderTool,
  type ProviderToolCatalog,
} from '@/lib/vendors/tools';

export const dynamic = 'force-dynamic';

/** 这些工具走独立接口还是随推理请求下发——两者的接入方式完全不同，必须一眼看出来。 */
function InvocationCell({ tool }: { tool: ProviderTool }) {
  if (tool.invocation.kind === 'endpoint') {
    return (
      <div className="space-y-1">
        <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
          独立接口
        </span>
        <code className="block break-all text-[11px] text-muted-foreground">
          {tool.invocation.method} {tool.invocation.url}
        </code>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <span className="inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
        随推理请求
      </span>
      <div className="flex flex-wrap gap-1">
        {tool.invocation.surfaces.map((surface) => (
          <span key={surface} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">
            {SURFACE_LABELS[surface]}
          </span>
        ))}
      </div>
    </div>
  );
}

function BillingCell({ tool }: { tool: ProviderTool }) {
  const unknown = tool.billing.unit === 'unknown';
  return (
    <div className="space-y-1">
      <span className={unknown ? 'text-muted-foreground' : 'font-medium text-foreground'}>
        {formatToolBilling(tool.billing)}
      </span>
      {tool.variants && (
        <ul className="space-y-0.5">
          {tool.variants.map((variant) => (
            <li key={variant.id} className="text-[11px] text-muted-foreground">
              {variant.name} · {formatToolBilling(variant.billing)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CatalogCard({ catalog, configured }: { catalog: ProviderToolCatalog; configured: string[] }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{catalog.vendor}</h2>
          {catalog.host && (
            <code className="text-[11px] text-muted-foreground">{catalog.host}</code>
          )}
        </div>
        {configured.length > 0 ? (
          <span className="rounded bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            已配置：{configured.join('、')}
          </span>
        ) : (
          <span className="rounded bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
            未配置此服务商
          </span>
        )}
      </header>

      {catalog.note && (
        <p className="border-b border-border bg-muted/30 px-4 py-2 text-xs text-muted-foreground sm:px-5">
          {catalog.note}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium sm:px-5">工具</th>
              <th className="px-4 py-2 font-medium">调用方式</th>
              <th className="px-4 py-2 font-medium">计费</th>
            </tr>
          </thead>
          <tbody>
            {catalog.tools.map((tool) => (
              <tr key={tool.id} className="border-b border-border/60 align-top last:border-0">
                <td className="px-4 py-3 sm:px-5">
                  <a
                    href={tool.docUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-foreground underline-offset-2 hover:underline"
                  >
                    {tool.name}
                  </a>
                  <p className="mt-0.5 text-xs text-muted-foreground">{tool.description}</p>
                  {tool.note && <p className="mt-1 text-[11px] text-muted-foreground">{tool.note}</p>}
                </td>
                <td className="px-4 py-3"><InvocationCell tool={tool} /></td>
                <td className="px-4 py-3"><BillingCell tool={tool} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
        据官方文档整理，核对于 {catalog.verifiedAt}
      </footer>
    </section>
  );
}

export default function ToolsPage() {
  const providers = listProviders();
  const configuredFor = (catalog: ProviderToolCatalog) =>
    providers
      .filter((p) => catalog.presetKeys.includes(p.slug) || (p.presetKey ? catalog.presetKeys.includes(p.presetKey) : false))
      .map((p) => p.name);

  return (
    <div>
      <PageHeader
        heading="工具服务"
        description="各服务商在模型推理之外提供的工具接口：联网搜索、网页抓取、文件解析、代码执行等，以及它们的接入方式与计费口径。"
      />
      <p className="mb-4 rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        本页是<strong className="text-foreground">参考目录</strong>，网关不代理这些工具调用，需要你直接对厂商接口发起请求。
        厂商没有提供「列出我有哪些工具」的查询接口，因此这份目录按官方文档人工维护；
        <strong className="text-foreground">标注「官方未公布」的价格就是官方确实没写</strong>，没有按同类产品推测填数。
      </p>
      <div className="space-y-4">
        {PROVIDER_TOOL_CATALOGS.map((catalog) => (
          <CatalogCard key={catalog.vendor} catalog={catalog} configured={configuredFor(catalog)} />
        ))}
      </div>
    </div>
  );
}
