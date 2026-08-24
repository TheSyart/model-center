import assert from 'node:assert/strict';
import test from 'node:test';

import { PROVIDER_PRESETS } from '../lib/presets/index.ts';
import {
  addFormEndpoint,
  createCustomFormEndpoints,
  filterProviderPresets,
  removeFormEndpoint,
  setFormDefaultProtocol,
  setFormEndpointEnabled,
  validateFormEndpoints,
} from '../lib/services/provider-form.ts';

test('preset search and sorting surfaces each logical provider once with legacy slug matches', () => {
  const all = filterProviderPresets(PROVIDER_PRESETS, '');
  assert.equal(all.length, 82);
  assert.equal(new Set(all.map((preset) => preset.presetKey)).size, 82);

  const codex = filterProviderPresets(PROVIDER_PRESETS, 'openai-official-responses');
  assert.equal(codex.length, 1);
  assert.equal(codex[0]?.name, 'Codex');

  const sample = filterProviderPresets([
    { presetKey: 'z', slug: 'z', name: '智谱', recommended: false, legacySlugs: [], endpoints: [] },
    { presetKey: 'a', slug: 'a', name: '阿里', recommended: true, legacySlugs: [], endpoints: [] },
    { presetKey: 'b', slug: 'b', name: '百度', recommended: true, legacySlugs: [], endpoints: [] },
  ] as unknown as typeof PROVIDER_PRESETS, '');
  assert.deepEqual(sample.map((preset) => preset.presetKey), ['a', 'b', 'z']);
});

test('controlled form endpoints keep one unique enabled default and enforce 1–4 protocols', () => {
  const initial = createCustomFormEndpoints();
  assert.deepEqual(initial, [{ protocol: 'openai', base_url: '', enabled: true, is_default: true }]);

  const withAnthropic = addFormEndpoint(initial, 'anthropic');
  const withResponses = addFormEndpoint(withAnthropic, 'openai-responses');
  const complete = addFormEndpoint(withResponses, 'gemini');
  assert.equal(complete.length, 4);
  assert.throws(() => addFormEndpoint(complete, 'openai'), /最多只能配置 4 个端点/);
  assert.throws(() => addFormEndpoint(withAnthropic, 'anthropic'), /协议不能重复/);

  const anthropicDefault = setFormDefaultProtocol(withAnthropic, 'anthropic');
  assert.deepEqual(
    anthropicDefault.map((endpoint) => [endpoint.protocol, endpoint.is_default]),
    [['openai', false], ['anthropic', true]],
  );
  assert.deepEqual(
    removeFormEndpoint(anthropicDefault, 'anthropic').map((endpoint) => [endpoint.protocol, endpoint.is_default]),
    [['openai', true]],
  );

  const disabledDefault = setFormEndpointEnabled(anthropicDefault, 'anthropic', false);
  assert.equal(disabledDefault.find((endpoint) => endpoint.protocol === 'openai')?.is_default, true);
  assert.equal(disabledDefault.find((endpoint) => endpoint.protocol === 'anthropic')?.enabled, false);
  assert.throws(() => removeFormEndpoint(initial, 'openai'), /至少需要保留一个端点/);
  assert.throws(
    () => validateFormEndpoints([{ protocol: 'openai', base_url: '', enabled: false, is_default: true }]),
    /至少需要一个启用的端点/,
  );
});
