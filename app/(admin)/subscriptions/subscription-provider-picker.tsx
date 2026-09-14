'use client';

import { useState } from 'react';
import type { SubscriptionCatalogItem } from '@/lib/subscriptions/catalog';
import type { SubscriptionVendor } from '@/lib/subscriptions/types';

export function SubscriptionLogo({
  name,
  logo,
}: {
  name: string;
  logo?: string;
}) {
  const [failed, setFailed] = useState(false);
  return logo && !failed ? (
    <img
      src={logo}
      alt=""
      className={`size-7 shrink-0 rounded-md object-contain ${['/logos/anthropic.svg', '/logos/openai.svg', '/logos/github.svg', '/logos/xai.svg'].includes(logo) ? 'dark:invert' : ''}`}
      onError={() => setFailed(true)}
    />
  ) : (
    <span
      aria-hidden="true"
      className="flex size-7 shrink-0 items-center justify-center rounded-md border bg-muted text-xs font-semibold text-muted-foreground"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function SubscriptionProviderPicker({
  catalog,
  busy,
  onLogin,
}: {
  catalog: SubscriptionCatalogItem[];
  busy: boolean;
  onLogin: (vendor: SubscriptionVendor) => void;
}) {
  return (
    <section
      aria-label="订阅登录服务商"
      className="mb-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
    >
      {catalog.map((item) => (
        <button
          key={item.presetKey}
          type="button"
          aria-label={
            item.vendor ? `登录 ${item.name}` : `${item.name}（尚未开放）`
          }
          disabled={busy || !item.vendor}
          title={item.vendor ? undefined : '登录功能尚未开发，保留占位'}
          onClick={() => {
            if (item.vendor) onLogin(item.vendor);
          }}
          className="flex min-h-20 items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-left transition-colors enabled:hover:border-foreground/25 enabled:hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/30"
        >
          <SubscriptionLogo name={item.name} logo={item.logo} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">{item.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {item.vendor ? '授权登录' : '尚未开放 · 敬请期待'}
            </span>
          </span>
        </button>
      ))}
    </section>
  );
}
