import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { getPreset, PROVIDER_PRESETS, presetDisplayName, presetsByCategory } from '../lib/presets/index.ts';

test('uses logical generated CC Switch provider groups without legacy duplicates', () => {
  assert.equal(PROVIDER_PRESETS.length, 82);
  assert.equal(new Set(PROVIDER_PRESETS.map((preset) => preset.slug)).size, PROVIDER_PRESETS.length);
});

test('resolves canonical logical keys and every old low-level variant slug', () => {
  const codex = PROVIDER_PRESETS.find((preset) => preset.name === 'Codex');
  assert.ok(codex);
  assert.equal(getPreset(codex.slug)?.presetKey, codex.presetKey);
  assert.equal(getPreset('codex-responses')?.presetKey, codex.presetKey);
  assert.equal(getPreset('openai-official-responses')?.presetKey, codex.presetKey);
  assert.equal(presetsByCategory().flatMap((group) => group.presets).length, 82);
});

test('marks unsupported OAuth and Bedrock presets in their display labels', () => {
  const oauth = PROVIDER_PRESETS.find((preset) => preset.authMode === 'oauth');
  const bedrock = PROVIDER_PRESETS.find((preset) => /Bedrock/i.test(preset.name));
  assert.equal(oauth?.supported, false);
  assert.match(presetDisplayName(oauth!), /暂不支持/);
  assert.equal(bedrock?.supported, false);
});

test('every generated provider logo points to a copied asset', () => {
  const missing = PROVIDER_PRESETS
    .filter((preset) => preset.logo)
    .filter((preset) => !fs.existsSync(path.join(import.meta.dirname, '..', 'public', preset.logo!.replace(/^\//, ''))))
    .map((preset) => `${preset.slug}: ${preset.logo}`);
  assert.deepEqual(missing, []);
});
