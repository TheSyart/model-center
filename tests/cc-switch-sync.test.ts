import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyPricingRepairs,
  collectProviderExports,
  mergeProviderRecords,
  normalizeProviderRecord,
  parseModelPricingSource,
  resolveIconAssetFiles,
} from '../scripts/cc-switch-sync-lib.ts';

function providerOf(result: ReturnType<typeof normalizeProviderRecord>) {
  if (result.status !== 'included') throw new Error('unexpected provider exclusion');
  return result.provider;
}

test('applies guarded pricing repairs in source order', () => {
  const source = String.raw`
    fn seed_model_pricing() {
      let pricing_data = [
        ("model-a", "Model A", "1", "2", "0.1", "0.5"),
        ("model-b", "Model B", "3", "4", "0", "0"),
      ];
    }
    fn repair_current_model_pricing() {
      let pricing_fixes = [
        ("model-a", "Model A", "2", "4", "0.2", "1", "1", "2", "0.1", "0.5"),
        ("model-a", "Model A", "3", "6", "0.3", "1.5", "2", "4", "0.2", "1"),
        ("model-b", "Model B", "9", "9", "9", "9", "8", "8", "8", "8"),
      ];
    }
  `;

  const result = parseModelPricingSource(source);
  assert.deepEqual(result, [
    { modelId: 'model-a', displayName: 'Model A', input: 3, output: 6, cacheRead: 0.3, cacheWrite: 1.5 },
    { modelId: 'model-b', displayName: 'Model B', input: 3, output: 4, cacheRead: 0, cacheWrite: 0 },
  ]);
});

test('does not mutate seed rows while applying repairs', () => {
  const seed = [{ modelId: 'm', displayName: 'M', input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }];
  const result = applyPricingRepairs(seed, [
    {
      modelId: 'm', displayName: 'M', input: 2, output: 4, cacheRead: 0.2, cacheWrite: 1,
      oldInput: 1, oldOutput: 2, oldCacheRead: 0, oldCacheWrite: 0,
    },
  ]);
  assert.equal(result[0]?.input, 2);
  assert.equal(seed[0]?.input, 1);
});

test('keeps the first duplicate seed row to mirror SQLite INSERT OR IGNORE', () => {
  const source = String.raw`
    fn seed_model_pricing() {
      let pricing_data = [
        ("same-model", "First", "1", "2", "0.1", "0.5"),
        ("same-model", "Second", "8", "9", "0.8", "1.5"),
      ];
    }
    fn repair_current_model_pricing() {
      let pricing_fixes = [];
    }
  `;
  assert.deepEqual(parseModelPricingSource(source), [
    { modelId: 'same-model', displayName: 'First', input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 },
  ]);
});

test('normalizes representative provider shapes without losing provenance', () => {
  const claude = normalizeProviderRecord('claude', 0, {
    name: 'Kimi', websiteUrl: 'https://kimi.com', category: 'cn_official', icon: 'kimi',
    settingsConfig: { env: { ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding/' } },
  });
  const codex = normalizeProviderRecord('codex', 2, {
    name: 'DeepSeek', websiteUrl: 'https://deepseek.com', apiFormat: 'openai_responses',
    config: 'base_url = "https://api.deepseek.com/v1"\nmodel = "deepseek-v4-flash"\nwire_api = "responses"',
  });
  const openclaw = normalizeProviderRecord('openclaw', 3, {
    name: 'Bedrock', websiteUrl: 'https://aws.amazon.com/bedrock',
    settingsConfig: { baseUrl: 'https://bedrock-runtime.us-east-1.amazonaws.com', api: 'bedrock-converse-stream', models: [] },
  });
  const priced = normalizeProviderRecord('openclaw', 4, {
    name: 'Priced', websiteUrl: 'https://priced.example',
    settingsConfig: { models: { providers: { priced: { baseUrl: 'https://api.priced.example/v1', api: 'openai-completions', models: [
      {
        id: 'priced-model', name: 'Priced Model', cost: { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 },
        reasoning: true, inputModalities: ['text', 'image'], supportsParallelToolCalls: false,
        compat: { maxTokensField: 'max_tokens' }, thinkingProfile: 'deepseekV4',
      },
    ] } } } },
  });

  const claudeProvider = providerOf(claude);
  const codexProvider = providerOf(codex);
  const openclawProvider = providerOf(openclaw);
  const pricedProvider = providerOf(priced);
  assert.equal(claudeProvider.baseUrl, 'https://api.kimi.com/coding');
  assert.equal(claudeProvider.protocol, 'anthropic');
  assert.deepEqual(claudeProvider.sourceApps, ['claude']);
  assert.equal(codexProvider.protocol, 'openai-responses');
  assert.deepEqual(codexProvider.models.map((model) => model.id), ['deepseek-v4-flash']);
  assert.equal(openclawProvider.supported, false);
  assert.match(openclawProvider.disabledReason ?? '', /Bedrock/i);
  assert.deepEqual(pricedProvider.models[0]?.pricing, { input: 1, output: 2, cacheRead: 0.1, cacheWrite: 0.5 });
  assert.deepEqual(pricedProvider.models[0]?.modalities, ['text', 'image']);
  assert.deepEqual(pricedProvider.models[0]?.capabilities, {
    compat: { maxTokensField: 'max_tokens' },
    reasoning: true,
    supportsParallelToolCalls: false,
    thinkingProfile: 'deepseekV4',
  });
});

test('keeps OAuth records disabled and custom templates explicitly excluded', () => {
  const oauth = normalizeProviderRecord('codex', 0, {
    name: 'Codex OAuth', websiteUrl: 'https://chatgpt.com', requiresOAuth: true,
    config: 'base_url = "https://chatgpt.com/backend-api/codex"',
  });
  const custom = normalizeProviderRecord('opencode', 1, {
    name: 'Custom', websiteUrl: '', isCustomTemplate: true, settingsConfig: {},
  });
  assert.equal(oauth.status, 'included');
  assert.equal(oauth.provider?.supported, false);
  assert.match(oauth.provider?.disabledReason ?? '', /OAuth/i);
  assert.equal(custom.status, 'excluded');
  assert.equal(custom.reason, 'custom-template');
});

test('keeps official direct presets and configurable gateways in the catalog', () => {
  const claude = normalizeProviderRecord('claude', 0, {
    name: 'Claude Official', websiteUrl: 'https://anthropic.com', isOfficial: true, settingsConfig: { env: {} },
  });
  const grok = normalizeProviderRecord('grok-build', 0, {
    name: 'Grok Official', websiteUrl: 'https://x.ai/grok', isOfficial: true, auth: {}, config: '',
  });
  const newApi = normalizeProviderRecord('universal', 0, {
    name: 'NewAPI', providerType: 'newapi', websiteUrl: 'https://newapi.pro', defaultApps: {}, defaultModels: {},
  });
  assert.equal(providerOf(claude).baseUrl, 'https://api.anthropic.com');
  assert.equal(providerOf(claude).supported, true);
  assert.equal(providerOf(grok).authMode, 'oauth');
  assert.equal(providerOf(grok).supported, false);
  assert.equal(newApi.status, 'included');
  assert.equal(providerOf(newApi).supported, false);
  assert.match(providerOf(newApi).disabledReason ?? '', /Base URL/i);
});

test('merges only matching provider identity, protocol and normalized base URL', () => {
  const records = [
    normalizeProviderRecord('claude', 0, {
      name: 'Kimi', websiteUrl: 'https://kimi.com', settingsConfig: { env: { ANTHROPIC_BASE_URL: 'https://api.kimi.com/coding/' } },
    }),
    normalizeProviderRecord('claude-desktop', 0, {
      name: 'Kimi', websiteUrl: 'https://kimi.com', baseUrl: 'https://api.kimi.com/coding', routes: [], apiFormat: 'anthropic',
    }),
    normalizeProviderRecord('codex', 0, {
      name: 'Kimi', websiteUrl: 'https://kimi.com', config: 'base_url = "https://api.kimi.com/coding/v1"', apiFormat: 'openai_responses',
    }),
    normalizeProviderRecord('codex', 1, {
      name: 'Kimi', websiteUrl: 'https://kimi.com', config: 'base_url = "https://backup.kimi.com/coding/v1"', apiFormat: 'openai_responses',
    }),
  ];
  const merged = mergeProviderRecords(records);
  assert.equal(merged.providers.length, 3);
  assert.equal(new Set(merged.providers.map((provider) => provider.slug)).size, 3);
  assert.deepEqual(merged.providers[0]?.sourceApps.sort(), ['claude', 'claude-desktop']);
  assert.equal(merged.coverage.included + merged.coverage.merged + merged.coverage.excluded, 4);
});

test('collects the Grok official preset before the Grok preset array', () => {
  const rows = collectProviderExports('grok-build', {
    grokBuildOfficialPreset: { name: 'Grok Official' },
    grokBuildProviderPresets: [{ name: 'Relay A' }, { name: 'Relay B' }],
  });
  assert.deepEqual(rows.map((row) => row.name), ['Grok Official', 'Relay A', 'Relay B']);
});

test('resolves CC Switch icon keys to real copied asset filenames', () => {
  const indexSource = `
    import _zeta from "./zetaapi-icon.png";
    import _ccsub from "./ccsub.svg?url";
    export const iconUrls = { zetaapi: _zeta, ccsub: _ccsub };
  `;
  const icons = resolveIconAssetFiles(indexSource, ['deepseek.svg', 'zetaapi-icon.png', 'ccsub.svg', 'amuxapi-icon.svg', 'algocode.svg']);
  assert.equal(icons.get('deepseek'), 'deepseek.svg');
  assert.equal(icons.get('zetaapi'), 'zetaapi-icon.png');
  assert.equal(icons.get('ccsub'), 'ccsub.svg');
  assert.equal(icons.get('amux'), 'amuxapi-icon.svg');
  assert.equal(icons.get('aigocode'), 'algocode.svg');
});
