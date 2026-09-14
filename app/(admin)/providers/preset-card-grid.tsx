'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { isOAuthOnlyPreset } from '@/lib/subscriptions/catalog';
import { getPreset, PROVIDER_PRESETS } from '@/lib/presets';
import { filterProviderPresets, protocolDisplayName } from '@/lib/services/provider-form';
import { cardCls, inputCls } from '@/components/ui/styles';

export interface PresetCardGridProps {
  selectedPresetKey: string | null;
  onSelectPreset: (presetKey: string | null) => void;
}

function PresetLogo({ slug, name, logo }: { slug: string; name: string; logo?: string }) {
  const [failed, setFailed] = useState(false);
  if (!logo || failed) {
    return <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-xs font-semibold text-muted-foreground">{name.slice(0, 1).toUpperCase()}</span>;
  }
  return <img src={logo} alt="" className="h-7 w-7 shrink-0 rounded-md object-contain" onError={() => setFailed(true)} />;
}

export default function PresetCardGrid({ selectedPresetKey, onSelectPreset }: PresetCardGridProps) {
  const [query, setQuery] = useState('');
  const presets = useMemo(() => filterProviderPresets(PROVIDER_PRESETS.filter(preset => !isOAuthOnlyPreset(preset)), query), [query]);
  const selected = selectedPresetKey ? getPreset(selectedPresetKey) : undefined;

  return (
    <fieldset className="min-w-0">
      <legend className="text-sm font-medium text-foreground">选择服务商预设</legend>
      <p className="mt-1 text-sm text-muted-foreground">选择预设后只需填写 API Key；授权登录请前往<Link href="/subscriptions" className="text-primary underline underline-offset-2">订阅账号</Link>。</p>
      <label className="mt-3 block">
        <span className="sr-only">搜索服务商预设</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称、slug 或旧版 slug" className={`w-full ${inputCls}`} />
      </label>
      <div className="minimal-scrollbar mt-3 max-h-[25rem] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            aria-pressed={!selectedPresetKey}
            onClick={() => onSelectPreset(null)}
            className={`min-h-11 rounded-lg border px-3 py-2.5 text-left transition-colors ${!selectedPresetKey ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-foreground/25 hover:bg-muted/55'}`}
          >
            <span className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted text-lg text-muted-foreground">+</span><span className="min-w-0"><span className="block truncate text-sm font-medium">自定义配置</span><span className="block truncate text-xs text-muted-foreground">手动填写端点</span></span></span>
          </button>
          {presets.map((preset) => {
            const disabled = preset.supported === false;
            const selectedCard = selected?.presetKey === preset.presetKey;
            const descriptionId = `preset-${preset.presetKey}-reason`;
            return (
              <button
                key={preset.presetKey}
                type="button"
                aria-pressed={selectedCard}
                aria-describedby={disabled ? descriptionId : undefined}
                aria-disabled={disabled}
                title={disabled ? preset.disabledReason ?? '当前网关暂不支持此预设' : undefined}
                onClick={() => { if (!disabled) onSelectPreset(preset.presetKey); }}
                className={`min-h-11 rounded-lg border px-3 py-2.5 text-left transition-colors ${selectedCard ? 'border-primary bg-primary-soft' : 'border-border bg-surface hover:border-foreground/25 hover:bg-muted/55'} ${disabled ? 'cursor-not-allowed opacity-55' : ''}`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <PresetLogo slug={preset.slug} name={preset.name} logo={preset.logo} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-1.5"><span className="truncate text-sm font-medium">{preset.name}</span>{preset.recommended && <span className="rounded-full bg-warning-soft px-1.5 py-0.5 text-[10px] font-medium text-warning">推荐</span>}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{preset.endpoints.length} 种格式 · 默认 {protocolDisplayName(preset.defaultProtocol)}</span>
                    {disabled && <span id={descriptionId} className="mt-1 block text-[11px] leading-4 text-destructive">{preset.disabledReason ?? '当前网关暂不支持此鉴权方式'}</span>}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {!presets.length && <p className={`${cardCls} mt-3 px-3 py-4 text-sm text-muted-foreground`}>没有匹配的服务商预设。</p>}
    </fieldset>
  );
}
