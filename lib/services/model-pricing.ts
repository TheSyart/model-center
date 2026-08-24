import catalog from '../presets/cc-switch-catalog.json' with { type: 'json' };
import manifest from '../presets/cc-switch-manifest.json' with { type: 'json' };
import { CC_SWITCH_PRICING } from '../pricing/cc-switch.ts';
import type { ModelPricingRow } from '../../scripts/cc-switch-sync-lib.ts';
import type { BundledPricing } from '../db/pricing-migration.ts';

interface CatalogProvider {
  baseUrl: string;
  protocol: string;
  models: Array<{ id: string; pricing?: { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null } }>;
}

export const CC_SWITCH_PRICING_SOURCE_REF = manifest.commit;

function canonicalUrl(value: string): string {
  return value.trim().replace(/\/+$/, '').toLowerCase();
}

function modelCandidates(modelId: string): string[] {
  const exact = modelId.trim().toLowerCase();
  const bare = exact.split('/').pop() ?? exact;
  return exact === bare ? [exact] : [exact, bare];
}

export function lookupPricingFromCatalog(
  providers: CatalogProvider[],
  globalPricing: ModelPricingRow[],
  baseUrl: string,
  protocol: string,
  modelId: string,
): BundledPricing | null {
  const ids = modelCandidates(modelId);
  const provider = providers.find(
    (candidate) => candidate.protocol === protocol && canonicalUrl(candidate.baseUrl) === canonicalUrl(baseUrl),
  );
  const providerModel = provider?.models.find((model) => ids.includes(model.id.toLowerCase()));
  if (providerModel?.pricing) return { ...providerModel.pricing, source: 'cc-switch-provider' };

  const global = globalPricing.find((pricing) => ids.includes(pricing.modelId.toLowerCase()));
  if (!global) return null;
  return {
    input: global.input,
    output: global.output,
    cacheRead: global.cacheRead,
    cacheWrite: global.cacheWrite,
    source: 'cc-switch-global',
  };
}

export function lookupBundledPricing(baseUrl: string, protocol: string, modelId: string): BundledPricing | null {
  return lookupPricingFromCatalog(catalog.providers as CatalogProvider[], CC_SWITCH_PRICING, baseUrl, protocol, modelId);
}
