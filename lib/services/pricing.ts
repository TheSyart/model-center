import type { UsageInfo } from './usage-metrics';

export interface TokenPricing {
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  cacheWrite: number | null;
}

function tokenCount(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function pricedCost(tokens: number, price: number | null): number | null {
  if (tokens === 0) return 0;
  return price == null || !Number.isFinite(price) || price < 0 ? null : (tokens * price) / 1_000_000;
}

export function calculateRequestCost({ usage, pricing }: { usage: UsageInfo; pricing: TokenPricing }): number | null {
  const classes = usage.cache_metrics_observed
    ? [
        [tokenCount(usage.uncached_input_tokens), pricing.input],
        [tokenCount(usage.completion_tokens), pricing.output],
        [tokenCount(usage.cache_read_tokens), pricing.cacheRead],
        [tokenCount(usage.cache_write_tokens), pricing.cacheWrite],
      ] as const
    : [
        [tokenCount(usage.prompt_tokens), pricing.input],
        [tokenCount(usage.completion_tokens), pricing.output],
      ] as const;
  let total = 0;
  for (const [tokens, price] of classes) {
    const cost = pricedCost(tokens, price);
    if (cost == null) return null;
    total += cost;
  }
  return Number(total.toFixed(12));
}

export function resolveModelPricing(input: {
  manual?: TokenPricing | null;
  providerSpecific?: TokenPricing | null;
  global?: TokenPricing | null;
}): { source: 'manual' | 'cc-switch-provider' | 'cc-switch-global'; pricing: TokenPricing } | null {
  if (input.manual) return { source: 'manual', pricing: input.manual };
  if (input.providerSpecific) return { source: 'cc-switch-provider', pricing: input.providerSpecific };
  if (input.global) return { source: 'cc-switch-global', pricing: input.global };
  return null;
}
