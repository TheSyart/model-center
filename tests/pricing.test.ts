import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateRequestCost, resolveModelPricing } from '../lib/services/pricing.ts';
import { lookupBundledPricing, lookupPricingFromCatalog } from '../lib/pricing/bundled.ts';

test('calculates four-class cost when cache metrics are observed', () => {
  assert.equal(calculateRequestCost({
    usage: { uncached_input_tokens: 100, completion_tokens: 20, cache_read_tokens: 50, cache_write_tokens: 10, cache_metrics_observed: true },
    pricing: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 1.25 },
  }), 0.0001575);
});

test('falls back to prompt and output pricing when cache details are unknown', () => {
  assert.equal(calculateRequestCost({
    usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120, cache_metrics_observed: false },
    pricing: { input: 1, output: 2, cacheRead: null, cacheWrite: null },
  }), 0.00014);
});

test('returns null when a used token class has no price but accepts explicit zero', () => {
  assert.equal(calculateRequestCost({
    usage: { uncached_input_tokens: 10, completion_tokens: 0, cache_read_tokens: 5, cache_write_tokens: 0, cache_metrics_observed: true },
    pricing: { input: 0, output: 0, cacheRead: null, cacheWrite: null },
  }), null);
  assert.equal(calculateRequestCost({
    usage: { uncached_input_tokens: 10, completion_tokens: 0, cache_read_tokens: 5, cache_write_tokens: 0, cache_metrics_observed: true },
    pricing: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  }), 0);
});

test('manual pricing wins over provider-specific and global pricing', () => {
  const resolved = resolveModelPricing({
    manual: { input: 9, output: 9, cacheRead: 9, cacheWrite: 9 },
    providerSpecific: { input: 2, output: 3, cacheRead: 0.2, cacheWrite: 1 },
    global: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 },
  });
  assert.equal(resolved?.source, 'manual');
  assert.equal(resolved?.pricing.input, 9);
});

test('prefers provider-specific catalog pricing over the global model table', () => {
  const result = lookupPricingFromCatalog(
    [{ baseUrl: 'https://api.example.com/v1', protocol: 'openai', models: [
      { id: 'vendor/model-a', pricing: { input: 7, output: 8, cacheRead: 0.7, cacheWrite: 1.5 } },
    ] }],
    [{ modelId: 'model-a', displayName: 'A', input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 }],
    'https://api.example.com/v1/',
    'openai',
    'vendor/model-a',
  );
  assert.deepEqual(result, { input: 7, output: 8, cacheRead: 0.7, cacheWrite: 1.5, source: 'cc-switch-provider' });
});

test('loads the repaired DeepSeek pricing from the pinned CC Switch snapshot', () => {
  assert.deepEqual(lookupBundledPricing('https://api.deepseek.com/v1', 'openai', 'deepseek-v4-flash'), {
    input: 0.44,
    output: 1.32,
    cacheRead: 0.014,
    cacheWrite: 0,
    source: 'cc-switch-provider',
  });
});

test('non-USD pricing yields an unknown cost instead of a wrong one', () => {
  const usage = { prompt_tokens: 1_000_000, completion_tokens: 0, total_tokens: 1_000_000, cache_metrics_observed: false };
  // 同样的数字，币种不同：美元照算，人民币拒绝折算。
  assert.equal(calculateRequestCost({ usage, pricing: { input: 4, output: 4, cacheRead: null, cacheWrite: null, currency: 'USD' } }), 4);
  assert.equal(calculateRequestCost({ usage, pricing: { input: 4, output: 4, cacheRead: null, cacheWrite: null, currency: 'CNY' } }), null);
  // 币种未知时沿用既有行为（cc-switch 表就是美元）。
  assert.equal(calculateRequestCost({ usage, pricing: { input: 4, output: 4, cacheRead: null, cacheWrite: null, currency: null } }), 4);
  assert.equal(calculateRequestCost({ usage, pricing: { input: 4, output: 4, cacheRead: null, cacheWrite: null } }), 4);
});

test('official vendor pricing outranks the bundled catalog but never the manual override', () => {
  const official = { input: 5, output: 6, cacheRead: null, cacheWrite: null, currency: 'CNY' };
  const bundled = { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 };
  assert.equal(resolveModelPricing({ official, providerSpecific: bundled, global: bundled })?.source, 'aliyun-modelstudio');
  assert.equal(
    resolveModelPricing({ manual: { input: 9, output: 9, cacheRead: 9, cacheWrite: 9 }, official, global: bundled })?.source,
    'manual',
  );
});
