'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { btn, cardCls, inputCls } from '@/components/ui/styles';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPreset } from '@/lib/presets';
import {
  addFormEndpoint,
  createCustomFormEndpoints,
  FORM_ENDPOINT_PROTOCOLS,
  protocolDisplayName,
  removeFormEndpoint,
  setFormDefaultProtocol,
  setFormEndpointEnabled,
  type ProviderFormEndpoint,
} from '@/lib/services/provider-form';
import type { ProviderProtocol } from '@/lib/presets/types';
import type { ProviderFormState } from './provider-types';
import PresetCardGrid from './preset-card-grid';
import { isOfficialBailianCatalogProvider } from '@/lib/services/bailian-catalog';

export interface ProviderFormProps {
  value: ProviderFormState;
  error: string;
  saving: boolean;
  onChange: (value: ProviderFormState) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  embedded?: boolean;
}

function presetEndpoints(presetKey: string): ProviderFormEndpoint[] {
  const preset = getPreset(presetKey);
  if (!preset) return createCustomFormEndpoints();
  return preset.endpoints.map((endpoint) => ({
    protocol: endpoint.protocol,
    base_url: endpoint.baseUrl,
    enabled: true,
    is_default: endpoint.protocol === preset.defaultProtocol,
  }));
}

function EndpointEditor({ endpoints, onChange }: { endpoints: ProviderFormEndpoint[]; onChange: (endpoints: ProviderFormEndpoint[]) => void }) {
  const available = FORM_ENDPOINT_PROTOCOLS.filter((protocol) => !endpoints.some((endpoint) => endpoint.protocol === protocol));
  return (
    <fieldset className="mt-4 border-t border-border pt-4">
      <legend className="text-sm font-medium">接入端点</legend>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">每种协议最多一个端点；默认端点用于测速、余额、模型同步和兼容投影。</p>
      <div className="mt-3 space-y-3">
        {endpoints.map((endpoint) => (
          <div key={endpoint.protocol} className="grid gap-3 rounded-lg border border-border bg-muted/35 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
            <div>
              <div className="text-sm font-medium">{protocolDisplayName(endpoint.protocol)}</div>
              <div className="text-xs text-muted-foreground">{endpoint.protocol}</div>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">Base URL</span>
              <input value={endpoint.base_url} onChange={(event) => onChange(endpoints.map((item) => item.protocol === endpoint.protocol ? { ...item, base_url: event.target.value } : item))} placeholder="https://api.example.com/v1" className={`w-full ${inputCls}`} required />
            </label>
            <div className="flex min-h-10 flex-wrap items-center gap-2 sm:justify-end">
              <label className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={endpoint.enabled} disabled={endpoint.enabled && endpoints.filter((item) => item.enabled).length === 1} onCheckedChange={(checked) => onChange(setFormEndpointEnabled(endpoints, endpoint.protocol, checked === true))} />启用</label>
              <label className="inline-flex min-h-11 items-center gap-2 text-xs text-muted-foreground"><input type="radio" name="default-endpoint" checked={endpoint.is_default} disabled={!endpoint.enabled} onChange={() => onChange(setFormDefaultProtocol(endpoints, endpoint.protocol))} className="h-4 w-4 accent-primary" />默认</label>
              <button type="button" onClick={() => onChange(removeFormEndpoint(endpoints, endpoint.protocol))} disabled={endpoints.length === 1} className={`${btn.ghost} min-h-11`}>移除</button>
            </div>
          </div>
        ))}
      </div>
      {available.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><span className="text-muted-foreground">增加协议</span><Select value="" onValueChange={(value) => onChange(addFormEndpoint(endpoints, value as ProviderProtocol))}><SelectTrigger aria-label="增加协议端点" className="w-64"><SelectValue placeholder="选择协议…" /></SelectTrigger><SelectContent>{available.map((protocol) => <SelectItem key={protocol} value={protocol}>{protocolDisplayName(protocol)} · {protocol}</SelectItem>)}</SelectContent></Select></div>}
    </fieldset>
  );
}

export default function ProviderForm({ value, error, saving, onChange, onSubmit, onCancel, embedded = false }: ProviderFormProps) {
  const isEdit = value.id !== null;
  const advancedId = isEdit ? 'provider-edit-advanced-config' : 'provider-create-advanced-config';
  const [advanced, setAdvanced] = useState(isEdit || !value.preset_key);
  const [showKey, setShowKey] = useState(false);
  const isBailian = isOfficialBailianCatalogProvider({ slug: value.slug, presetKey: value.preset_key });
  useEffect(() => setAdvanced(isEdit || !value.preset_key), [isEdit, value.preset_key]);

  function selectPreset(presetKey: string | null) {
    const preset = presetKey ? getPreset(presetKey) : undefined;
    onChange({
      ...value,
      preset_key: preset?.presetKey ?? null,
      slug: preset?.slug ?? '',
      name: preset?.name ?? '',
      workspace_id: preset?.presetKey === 'bailian' ? value.workspace_id : '',
      endpoints: preset ? presetEndpoints(preset.presetKey) : createCustomFormEndpoints(),
    });
  }

  return (
    <form onSubmit={onSubmit} className={embedded ? '' : `mb-6 ${cardCls} p-4 sm:p-6`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">{!embedded && <h2 className="text-lg font-semibold tracking-[-0.02em]">{isEdit ? '编辑服务商' : '新建服务商'}</h2>}{value.preset_key && <span className="text-xs text-muted-foreground">预设：{value.preset_key}</span>}</div>
      {!isEdit && <div className="mt-5"><PresetCardGrid selectedPresetKey={value.preset_key} onSelectPreset={selectPreset} /></div>}
      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium text-muted-foreground">API Key{isEdit ? '（留空则不修改）' : '（加密存储）'}</span><div className="relative"><input type={showKey ? 'text' : 'password'} value={value.api_key} onChange={(event) => onChange({ ...value, api_key: event.target.value })} placeholder={isEdit ? '留空则不修改' : 'sk-…'} className={`w-full ${inputCls} pr-12`} required={!isEdit} /><button type="button" onClick={() => setShowKey((shown) => !shown)} aria-label={showKey ? '隐藏 API Key' : '显示 API Key'} className="absolute right-0.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground sm:right-1 sm:h-10 sm:w-10">{showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button></div></label>
        {isBailian && <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium text-muted-foreground">Workspace ID（北京地域）</span><input value={value.workspace_id} onChange={(event) => onChange({ ...value, workspace_id: event.target.value })} placeholder="llm-xxxxxxxxxxxxxxxx" className={`w-full ${inputCls}`} required /><span className="mt-1.5 block text-xs leading-5 text-muted-foreground">只用于官方模型目录；推理仍使用服务商端点中的 Base URL。</span></label>}
        <label className="block md:col-span-2"><span className="mb-1.5 block text-sm font-medium text-muted-foreground">备注</span><input value={value.remark} onChange={(event) => onChange({ ...value, remark: event.target.value })} className={`w-full ${inputCls}`} /></label>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <button type="button" aria-expanded={advanced} aria-controls={advancedId} onClick={() => setAdvanced((open) => !open)} className={`${btn.ghost} min-h-11`}>{advanced ? '收起高级配置' : '高级配置：名称、Slug 与端点'}</button>
        {advanced && <div id={advancedId} className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2"><label className="block"><span className="mb-1.5 block text-sm font-medium text-muted-foreground">Slug（唯一标识）</span><input value={value.slug} onChange={(event) => onChange({ ...value, slug: event.target.value })} disabled={isEdit} placeholder="deepseek" className={`w-full ${inputCls}`} required /></label><label className="block"><span className="mb-1.5 block text-sm font-medium text-muted-foreground">名称</span><input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} className={`w-full ${inputCls}`} required /></label><div className="md:col-span-2"><EndpointEditor endpoints={value.endpoints} onChange={(endpoints) => onChange({ ...value, endpoints })} /></div></div>}
      </div>
      {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}
      <div className="mt-5 flex flex-wrap gap-2"><button type="submit" disabled={saving} className={`${btn.primary} min-h-11`}>{saving ? '保存中…' : '保存服务商'}</button><button type="button" onClick={onCancel} className={`${btn.ghost} min-h-11`}>取消</button></div>
    </form>
  );
}
