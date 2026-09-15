import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanModelLabel, foldModelVariants, vendorFoldOptions } from '../lib/subscriptions/variants.ts';

test('display labels fold irregular IDs that only differ by a strength tag', () => {
  const models = foldModelVariants(
    [
      { id: 'gemini-next-pro-agent', displayName: 'Gemini Next Pro (High)' },
      { id: 'gemini-next-pro-lite-slot', displayName: 'Gemini Next Pro (Low)' },
      { id: 'gemini-next-pro-medium', displayName: 'Gemini Next Pro (Medium)' },
    ],
    vendorFoldOptions('antigravity')
  );
  assert.equal(models.length, 1);
  assert.equal(models[0].id, 'gemini-next-pro');
  assert.equal(models[0].displayName, 'Gemini Next Pro');
  assert.deepEqual(models[0].reasoning?.variants, {
    high: 'gemini-next-pro-agent',
    low: 'gemini-next-pro-lite-slot',
    medium: 'gemini-next-pro-medium',
  });
  assert.equal(models[0].reasoning?.upstreamDefault, 'gemini-next-pro-agent');
});

test('generic catalogs only fold level suffixes that have a sibling, never products such as -max', () => {
  const models = foldModelVariants(
    [
      { id: 'gpt-5.1-codex', displayName: 'GPT-5.1-Codex' },
      { id: 'gpt-5.1-codex-max', displayName: 'GPT-5.1-Codex-Max' },
      { id: 'o3-mini', displayName: 'o3-mini' },
      { id: 'o3-mini-high', displayName: 'o3-mini (high)' },
      { id: 'claude-3.7-sonnet', displayName: 'Claude 3.7 Sonnet' },
      { id: 'claude-3.7-sonnet-thought', displayName: 'Claude 3.7 Sonnet Thinking' },
      { id: 'lonely-model-high', displayName: null },
      { id: 'gpt-5.5-low', displayName: null, reasoning: { control: 'level', efforts: ['low', 'high'] } },
      { id: 'gpt-5.5', displayName: null },
    ],
    vendorFoldOptions('copilot')
  );
  const byId = Object.fromEntries(models.map((m) => [m.id, m]));
  assert.deepEqual(Object.keys(byId).sort(), [
    'claude-3.7-sonnet',
    'gpt-5.1-codex',
    'gpt-5.1-codex-max',
    'gpt-5.5',
    'gpt-5.5-low',
    'lonely-model-high',
    'o3-mini',
  ]);
  assert.deepEqual(byId['o3-mini'].reasoning, {
    control: 'level',
    upstreamDefault: 'o3-mini',
    legacyIds: ['o3-mini-high'],
    variants: { high: 'o3-mini-high' },
  });
  assert.deepEqual(byId['claude-3.7-sonnet'].reasoning, {
    control: 'budget',
    upstreamDefault: 'claude-3.7-sonnet',
    legacyIds: ['claude-3.7-sonnet-thought'],
    thinkingVariant: 'claude-3.7-sonnet-thought',
  });
  assert.equal(byId['gpt-5.1-codex'].reasoning, undefined);
  assert.deepEqual(byId['gpt-5.1-codex'].endpoints, ['openai']);
});

test('strength labels are removed in both half- and full-width brackets', () => {
  assert.equal(cleanModelLabel('Gemini 3 Pro（High）'), 'Gemini 3 Pro');
  assert.equal(cleanModelLabel('Claude Opus 4.6 (Thinking)'), 'Claude Opus 4.6');
  assert.equal(cleanModelLabel('GPT-OSS 120B'), 'GPT-OSS 120B');
  assert.equal(cleanModelLabel(null), null);
});
