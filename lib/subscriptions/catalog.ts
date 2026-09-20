import type { ProviderPreset } from '../presets/types.ts';
import type { SubscriptionVendor } from './types.ts';

export interface SubscriptionCatalogItem {
  presetKey: string;
  name: string;
  logo?: string;
  vendor: SubscriptionVendor | null;
}

const implemented: {
  presetKey: string;
  name: string;
  vendor: SubscriptionVendor;
  logo?: string;
}[] = [
  { presetKey: 'claude-official', name: 'auth-claude', vendor: 'claude' },
  { presetKey: 'codex', name: 'auth-codex', vendor: 'codex' },
  {
    presetKey: 'antigravity',
    name: 'auth-antigravity',
    vendor: 'antigravity',
    logo: '/subscriptions/antigravity.svg',
  },
  { presetKey: 'github-copilot', name: 'auth-copilot', vendor: 'copilot' },
];

/** Mixed API-key/OAuth providers retain their API-key entry. */
export function isOAuthOnlyPreset(preset: ProviderPreset): boolean {
  return (
    preset.authMode === 'oauth' &&
    !preset.endpoints.some((endpoint) =>
      endpoint.alternateCandidates.some(
        (candidate) => candidate.authMode === 'api-key'
      )
    )
  );
}

/** Read the original catalog without changing generated metadata or icon assets. */
export function buildSubscriptionCatalog(
  presets: ProviderPreset[]
): SubscriptionCatalogItem[] {
  const supported = implemented.map((item) => ({
    ...item,
    logo:
      item.logo ??
      presets.find((preset) => preset.presetKey === item.presetKey)?.logo,
  }));
  const placeholders = presets
    .filter(
      (preset) =>
        isOAuthOnlyPreset(preset) &&
        !implemented.some((item) => item.presetKey === preset.presetKey)
    )
    .map((preset) => ({
      presetKey: preset.presetKey,
      name: preset.name,
      logo: preset.logo,
      vendor: null,
    }));
  return [...supported, ...placeholders];
}
