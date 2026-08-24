/**
 * 服务商预设总表 = 内置主流 13 家（legacy.ts，含余额端点）+ cc-switch 全量预设（cc-switch.ts）。
 * 纯数据文件，不依赖 node API，可直接被前端组件导入。
 */
import { CC_SWITCH_PRESETS } from './cc-switch.ts';
import { LEGACY_PRESETS } from './legacy.ts';
import { CATEGORY_LABELS } from './types.ts';
import type { PresetCategory, ProviderPreset } from './types.ts';
import { detectCcSwitchBalanceProvider } from '../services/balance-provider.ts';

function canonicalUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function codingPlanFor(baseUrl: string): string | undefined {
  const url = canonicalUrl(baseUrl);
  if (url.includes('api.kimi.com/coding')) return 'kimi';
  if (url.includes('bigmodel.cn') || url.includes('api.z.ai')) return 'zhipu';
  if (url.includes('api.minimaxi.com')) return 'minimax-cn';
  if (url.includes('api.minimax.io')) return 'minimax-en';
  if (url.includes('zenmux')) return 'zenmux';
  if (url.includes('volces.com/api/plan') || url.includes('volces.com/api/coding')) return 'volcengine';
  return undefined;
}

function applyLocalOverrides(preset: ProviderPreset): ProviderPreset {
  const legacy = LEGACY_PRESETS.find(
    (candidate) => candidate.protocol === preset.protocol && canonicalUrl(candidate.baseUrl) === canonicalUrl(preset.baseUrl),
  );
  const balanceProvider = detectCcSwitchBalanceProvider(preset.baseUrl);
  return {
    ...preset,
    recommended: Boolean(legacy),
    balance: legacy?.balance ?? (balanceProvider ? { supported: true, note: `CC Switch 内置余额查询：${balanceProvider}` } : undefined),
    codingPlan: codingPlanFor(preset.baseUrl) ?? legacy?.codingPlan,
    consoleUrl: preset.consoleUrl ?? legacy?.consoleUrl,
  };
}

export const PROVIDER_PRESETS: ProviderPreset[] = CC_SWITCH_PRESETS.map(applyLocalOverrides);

export function getPreset(slug: string): ProviderPreset | undefined {
  const generated = PROVIDER_PRESETS.find((p) => p.slug === slug || p.presetKey === slug || p.legacySlugs.includes(slug));
  if (generated) return generated;
  const legacy = LEGACY_PRESETS.find((p) => p.slug === slug);
  if (!legacy) return undefined;
  const replacement = PROVIDER_PRESETS.find(
    (candidate) => candidate.protocol === legacy.protocol && canonicalUrl(candidate.baseUrl) === canonicalUrl(legacy.baseUrl),
  );
  return replacement
    ? {
        ...replacement,
        recommended: true,
        balance: legacy.balance ?? replacement.balance,
        codingPlan: legacy.codingPlan ?? replacement.codingPlan,
        consoleUrl: legacy.consoleUrl ?? replacement.consoleUrl,
      }
    : { ...legacy, recommended: true };
}

/** 协议后缀标签（同名多端点消歧用） */
const PROTOCOL_SUFFIX: Record<ProviderPreset['protocol'], string> = {
  openai: 'Chat',
  'openai-responses': 'Codex/Responses',
  anthropic: 'Claude 端点',
  gemini: 'Gemini 端点',
};

const nameCounts = new Map<string, number>();
for (const p of PROVIDER_PRESETS) {
  nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
}

/** 预设展示名：同一厂商多条预设时加端点类型后缀；推荐预设加（推荐）。 */
export function presetDisplayName(p: ProviderPreset): string {
  let label = p.name;
  if ((nameCounts.get(p.name) ?? 0) > 1) label += `（${PROTOCOL_SUFFIX[p.protocol]}）`;
  if (p.recommended) label += '（推荐）';
  if (p.supported === false) label += '（暂不支持）';
  return label;
}

/** 按分类分组（组内推荐预设在前），供 UI 分组展示。 */
export function presetsByCategory(): { category: PresetCategory; label: string; presets: ProviderPreset[] }[] {
  const order: PresetCategory[] = ['official', 'cn_official', 'cloud_provider', 'aggregator', 'third_party', 'relay', 'other'];
  return order
    .map((category) => ({
      category,
      label: CATEGORY_LABELS[category],
      presets: PROVIDER_PRESETS.filter((p) => p.category === category).sort(
        (a, b) => Number(b.recommended ?? false) - Number(a.recommended ?? false),
      ),
    }))
    .filter((g) => g.presets.length > 0);
}

export { CATEGORY_LABELS };
export type { PresetCategory, ProviderPreset };
