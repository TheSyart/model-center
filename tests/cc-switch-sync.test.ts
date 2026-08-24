import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import * as syncLibrary from '../scripts/cc-switch-sync-lib.ts';
import {
  applyPricingRepairs,
  collectProviderExports,
  mergeProviderRecords,
  normalizeProviderRecord,
  parseModelPricingSource,
  resolveIconAssetFiles,
} from '../scripts/cc-switch-sync-lib.ts';
import { LEGACY_PRESETS } from '../lib/presets/legacy.ts';

const currentCatalog = JSON.parse(
  fs.readFileSync(path.join(import.meta.dirname, '..', 'lib', 'presets', 'cc-switch-catalog.json'), 'utf8'),
) as { providers: Array<ReturnType<typeof providerOf>> };

type GroupingLibrary = typeof syncLibrary & {
  groupLogicalProviderPresets(
    providers: typeof currentCatalog.providers,
    legacyPresets: Array<{ slug: string; protocol: string; baseUrl: string }>,
  ): {
    logicalProviders: Array<{
      presetKey: string;
      slug: string;
      name: string;
      defaultProtocol: string;
      protocol: string;
      baseUrl: string;
      legacySlugs: string[];
      endpoints: Array<{
        protocol: string;
        baseUrl: string;
        selectedVariantSlug: string;
        sourceApps: string[];
        knownModels: unknown[];
        modelCatalogComplete: boolean;
        alternateCandidates: Array<{ variantSlug: string; baseUrl: string }>;
      }>;
    }>;
    semanticMergeCount: number;
  };
};

function logicalCatalog() {
  return (syncLibrary as GroupingLibrary).groupLogicalProviderPresets(currentCatalog.providers, LEGACY_PRESETS);
}

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

test('groups the pinned 255 variants into exactly 82 logical provider presets', () => {
  const grouped = logicalCatalog();
  assert.equal(grouped.logicalProviders.length, 82);
  assert.equal(grouped.semanticMergeCount, 9);
  assert.equal(new Set(grouped.logicalProviders.map((provider) => provider.presetKey)).size, 82);
  assert.deepEqual(grouped.logicalProviders.map((provider) => provider.slug), grouped.logicalProviders.map((provider) => provider.presetKey));
});

test('suffixes a generated canonical key that collides with a different legacy endpoint', () => {
  const ppio = logicalCatalog().logicalProviders.find((provider) => provider.name === 'PPIO');
  assert.ok(ppio);
  assert.equal(ppio.presetKey, 'ppio-cc-switch');
  assert.equal(ppio.slug, 'ppio-cc-switch');
});

test('fails fast for generated canonical key collisions in either input order', () => {
  const ppio = currentCatalog.providers.find((provider) => provider.slug === 'ppio-openai');
  assert.ok(ppio);
  const ppioCcSwitch = {
    ...ppio,
    slug: 'ppio-cc-switch-openai',
    name: 'PPIO CC Switch',
    baseUrl: 'https://ppio-cc-switch.example/v1',
  };
  const legacyPpio = [{ slug: 'ppio', protocol: 'openai', baseUrl: 'https://legacy-ppio.example/v1' }];
  const grouping = (variants: typeof currentCatalog.providers) =>
    (syncLibrary as GroupingLibrary).groupLogicalProviderPresets(variants, legacyPpio);

  for (const variants of [[ppio, ppioCcSwitch], [ppioCcSwitch, ppio]]) {
    assert.throws(() => grouping(variants), /逻辑服务商 canonical key 冲突：ppio-cc-switch/);
  }
});

test('applies exactly the eight reviewed semantic merge groups', () => {
  const grouped = logicalCatalog().logicalProviders;
  const provider = (name: string) => {
    const match = grouped.find((candidate) => candidate.name === name);
    assert.ok(match, `missing logical provider ${name}`);
    return match;
  };

  const approvedGroups: Array<{ name: string; variants: string[] }> = [
    { name: 'Claude Official', variants: ['claude-desktop-official-anthropic', 'claude-official-anthropic'] },
    { name: 'Gemini Native', variants: ['gemini-native-gemini', 'google-official-gemini'] },
    { name: 'xAI (Grok)', variants: ['grok-official-responses', 'xai-grok-oauth-responses', 'xai-grok-responses'] },
    { name: 'Codex', variants: ['codex-responses', 'openai-official-responses'] },
    {
      name: '火山 Coding Plan',
      variants: ['agentplan-openai', 'coding-plan-anthropic', 'coding-plan-openai', 'coding-plan-openai-ark', 'coding-plan-responses'],
    },
    { name: 'StepFun', variants: ['stepfun-anthropic', 'stepfun-openai', 'stepfun-openai-api', 'stepfun-step-plan-openai'] },
    { name: 'Bailian', variants: ['bailian-anthropic', 'bailian-openai', 'bailian-responses', 'qwen-coder-openai'] },
    {
      name: 'AWS Bedrock (AKSK)',
      variants: ['aws-bedrock-aksk-anthropic', 'aws-bedrock-anthropic', 'aws-bedrock-anthropic-bedrock-runtime', 'aws-bedrock-anthropic-bedrock-runtime-2'],
    },
  ];
  for (const expected of approvedGroups) {
    assert.deepEqual([...provider(expected.name).legacySlugs].sort(), expected.variants, `${expected.name} variants`);
  }
});

test('keeps prohibited provider identities separate', () => {
  const grouped = logicalCatalog().logicalProviders;
  const presetKey = (name: string) => {
    const provider = grouped.find((candidate) => candidate.name === name);
    assert.ok(provider, `missing logical provider ${name}`);
    return provider.presetKey;
  };
  const prohibitedPairs: Array<[string, string]> = [
    ['Kimi', 'Kimi For Coding'],
    ['SiliconFlow', 'SiliconFlow en'],
    ['Zhipu GLM', 'Zhipu GLM en'],
    ['StepFun', 'StepFun en'],
    ['MiniMax', 'MiniMax en'],
    ['火山 Coding Plan', '火山 Agent Plan'],
    ['Bailian', 'Bailian For Coding'],
    ['Baidu Qianfan Coding Plan', 'Baidu Qianfan Token Plan'],
    ['Compshare', 'Compshare Coding Plan'],
    ['AWS Bedrock (AKSK)', 'AWS Bedrock (API Key)'],
  ];
  for (const [left, right] of prohibitedPairs) {
    assert.notEqual(presetKey(left), presetKey(right), `${left} must remain separate from ${right}`);
  }
});

test('deduplicates protocols into endpoints and chooses supported source-priority defaults', () => {
  const bailian = logicalCatalog().logicalProviders.find((provider) => provider.name === 'Bailian');
  assert.ok(bailian);
  assert.equal(bailian.defaultProtocol, 'openai');
  assert.equal(bailian.protocol, 'openai');
  assert.equal(bailian.baseUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1');
  assert.deepEqual(bailian.endpoints.map((endpoint) => endpoint.protocol).sort(), ['anthropic', 'openai', 'openai-responses']);
  assert.equal(new Set(bailian.endpoints.map((endpoint) => endpoint.protocol)).size, bailian.endpoints.length);
  const openai = bailian.endpoints.find((endpoint) => endpoint.protocol === 'openai');
  assert.ok(openai);
  assert.equal(openai.selectedVariantSlug, 'bailian-openai');
  assert.equal(openai.modelCatalogComplete, false);
  assert.ok(openai.alternateCandidates.some((candidate) => candidate.variantSlug === 'qwen-coder-openai'));
});

test('covers every low-level variant exactly once as a logical group candidate and legacy alias', () => {
  const grouped = logicalCatalog().logicalProviders;
  const candidates = grouped.flatMap((provider) => provider.endpoints.flatMap((endpoint) => endpoint.alternateCandidates.map((candidate) => candidate.variantSlug)));
  const aliases = grouped.flatMap((provider) => provider.legacySlugs);
  const variants = currentCatalog.providers.map((provider) => provider.slug);
  assert.equal(candidates.length, 255);
  assert.equal(new Set(candidates).size, 255);
  assert.deepEqual([...candidates].sort(), [...variants].sort());
  assert.equal(aliases.length, 255);
  assert.equal(new Set(aliases).size, 255);
  assert.deepEqual([...aliases].sort(), [...variants].sort());
});
