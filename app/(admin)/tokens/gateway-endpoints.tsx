'use client';

import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { cardCls } from '@/components/ui/styles';
import { buildGatewayEndpoints } from '@/lib/gateway-endpoints';

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand('copy');
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function CopyableValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    if (!(await copyText(value))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-w-0">
      <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">{label}</div>
      <div className="flex min-h-10 items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
        <code className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-xs text-foreground" title={value}>
          {value}
        </code>
        <button
          type="button"
          onClick={onCopy}
          aria-label={`复制${label}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-subtle-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </button>
        <span className="sr-only" role="status" aria-live="polite">{copied ? `${label}已复制` : ''}</span>
      </div>
    </div>
  );
}

/** 当前站点的聚合协议入口，结构参考 DeepSeek 官方快速调用参数表。 */
export default function GatewayEndpoints() {
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const guide = origin ? buildGatewayEndpoints(origin) : null;

  return (
    <section className={`mb-8 overflow-hidden ${cardCls}`} aria-labelledby="gateway-endpoints-heading">
      <div className="border-b border-border px-5 py-5 sm:px-6">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">Quick start / 01</div>
        <h2 id="gateway-endpoints-heading" className="mt-2 text-lg font-semibold tracking-[-0.025em]">聚合模型调用接口</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
          同一令牌可调用全部已启用模型。model 支持路由别名、<code className="rounded bg-muted px-1.5 py-0.5 text-xs text-foreground">provider-slug/model</code> 或裸模型名。
        </p>
      </div>

      <div className="divide-y divide-border">
        {(guide?.protocols ?? []).map((protocol) => (
          <div key={protocol.id} className="grid gap-4 px-5 py-5 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)_minmax(0,1fr)] lg:items-end">
            <div>
              <div className="font-medium">{protocol.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{protocol.client}</div>
            </div>
            <CopyableValue label="Base URL" value={protocol.baseUrl} />
            <CopyableValue label="直接接口" value={protocol.endpoint} />
          </div>
        ))}

        {!guide && (
          <div className="px-5 py-8 text-sm text-subtle-foreground sm:px-6" role="status">正在读取当前访问地址…</div>
        )}

        {guide && (
          <div className="grid gap-5 bg-muted/35 px-5 py-5 sm:px-6 lg:grid-cols-2">
            <CopyableValue label="模型列表 · GET" value={guide.modelsUrl} />
            <div>
              <div className="mb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-subtle-foreground">鉴权</div>
              <div className="min-h-10 rounded-md border border-border bg-background px-3 py-2 text-xs leading-6">
                <code>Authorization: Bearer &lt;token&gt;</code>
                <span className="mx-2 text-border" aria-hidden="true">/</span>
                <span className="text-muted-foreground">Anthropic 也支持 </span><code>x-api-key</code>
              </div>
            </div>
          </div>
        )}

        {guide && (
          <div className="px-5 py-5 sm:px-6">
            <div className="mb-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-subtle-foreground">CC Switch</div>
              <h3 className="mt-1 text-sm font-semibold">模型列表配置</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">API Key 使用本页创建的网关令牌；Claude 配置关闭“完整接口 URL”模式。</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <CopyableValue label="Claude / Anthropic Base URL" value={guide.protocols.find((item) => item.id === 'anthropic')!.baseUrl} />
              <CopyableValue label="OpenAI / Codex Base URL" value={guide.protocols.find((item) => item.id === 'openai-chat')!.baseUrl} />
              <CopyableValue label="Models URL" value={guide.modelsUrl} />
            </div>
            <div className="mt-4 rounded-md border border-warning/25 bg-warning-soft px-3 py-2 text-xs leading-5 text-warning">
              Base URL 不要填写 <code>/v1/messages</code>、<code>/chat/completions</code> 或 <code>/responses</code>。CC Switch 会自动拼接模型列表路径，填写完整接口会产生错误的 <code>/v1/messages/v1/models</code> 地址。
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
