/**
 * 服务商预设总表 = 内置主流 13 家（legacy.ts，含余额端点）+ cc-switch 全量预设（cc-switch.ts）。
 * 纯数据文件，不依赖 node API，可直接被前端组件导入。
 */
import { CC_SWITCH_PRESETS } from './cc-switch';
import { LEGACY_PRESETS } from './legacy';
import { CATEGORY_LABELS } from './types';
import type { PresetCategory, ProviderPreset } from './types';

/** legacy 13 家标记为推荐 */
const LEGACY = LEGACY_PRESETS.map((p) => ({ ...p, recommended: true as const }));

export const PROVIDER_PRESETS: ProviderPreset[] = [...LEGACY, ...CC_SWITCH_PRESETS];

export function getPreset(slug: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.slug === slug);
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
  return label;
}

/** 按分类分组（组内推荐预设在前），供 UI 分组展示。 */
export function presetsByCategory(): { category: PresetCategory; label: string; presets: ProviderPreset[] }[] {
  const order: PresetCategory[] = ['official', 'cn_official', 'aggregator', 'relay', 'other'];
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
