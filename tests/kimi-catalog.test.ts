import assert from 'node:assert/strict';
import test from 'node:test';

import { isKimiCatalogProvider, parseKimiModelPage } from '../lib/services/kimi-catalog.ts';

// 2026-09-19 从 api.kimi.com/coding/v1/models 实测抓到的结构。
const live = {
  data: [
    {
      id: 'kimi-for-coding',
      created: 1761264000,
      object: 'model',
      display_name: 'K2.8 Preview',
      context_length: 1048576,
      supports_reasoning: true,
      supports_image_in: true,
      supports_video_in: true,
      supports_dynamic_tools: true,
      supports_thinking_type: 'only',
      think_efforts: { support: true, valid_efforts: ['low', 'high', 'max'], default_effort: 'max' },
    },
    {
      id: 'kimi-for-coding-highspeed',
      object: 'model',
      display_name: 'K2.7 Code Highspeed',
      context_length: 262144,
      supports_reasoning: true,
      supports_image_in: true,
      supports_video_in: true,
      supports_dynamic_tools: false,
      supports_thinking_type: 'only',
    },
  ],
};

test('detects Kimi by host, both the platform and the coding plan base', () => {
  assert.ok(isKimiCatalogProvider({ baseUrl: 'https://api.kimi.com/coding/v1' }));
  assert.ok(isKimiCatalogProvider({ baseUrl: 'https://api.moonshot.cn/v1' }));
  assert.ok(isKimiCatalogProvider({ baseUrl: 'https://api.moonshot.ai/v1' }));
  assert.equal(isKimiCatalogProvider({ baseUrl: 'https://api.deepseek.com/v1' }), false);
  // 别被域名里含 kimi 的第三方中转骗过去
  assert.equal(isKimiCatalogProvider({ baseUrl: 'https://kimi.some-relay.example/v1' }), false);
  assert.equal(isKimiCatalogProvider({ baseUrl: '' }), false);
  assert.equal(isKimiCatalogProvider({ baseUrl: 'not a url' }), false);
});

test('maps the live capability flags, keeping the highspeed variant as its own model', () => {
  const [base, highspeed] = parseKimiModelPage(live);

  assert.equal(base.id, 'kimi-for-coding');
  assert.equal(base.displayName, 'K2.8 Preview');
  assert.equal(base.contextWindow, 1048576);
  const caps = JSON.parse(base.capabilitiesJson!);
  assert.equal(caps.vision, true);
  assert.equal(caps.tools, true);        // supports_dynamic_tools
  assert.equal(caps.reasoning, true);
  assert.deepEqual(caps.modalities, ['Text', 'Image', 'Video']);
  assert.equal(caps.rawKimiFlags.supports_thinking_type, 'only');

  // 高速变体自带能力字段，不需要剥后缀去继承基础模型。
  assert.equal(highspeed.id, 'kimi-for-coding-highspeed');
  assert.equal(highspeed.contextWindow, 262144);
  assert.equal(JSON.parse(highspeed.capabilitiesJson!).tools, false);
});

test('think_efforts becomes the project reasoning metadata', () => {
  const [base, highspeed] = parseKimiModelPage(live);
  assert.deepEqual(JSON.parse(base.reasoningJson!), {
    efforts: ['low', 'high', 'max'],
    defaultEffort: 'max',
    control: 'level',
  });
  // 没有 think_efforts 就不写，而不是编一个默认档位。
  assert.equal(highspeed.reasoningJson, null);
});

test('an unrecognised effort level voids the whole reasoning record rather than half of it', () => {
  const [model] = parseKimiModelPage({
    data: [{ id: 'k9', think_efforts: { support: true, valid_efforts: ['low', 'ludicrous'] } }],
  });
  assert.equal(model.reasoningJson, null);
});

test('missing booleans stay absent so they resolve to unknown, not unsupported', () => {
  const [model] = parseKimiModelPage({ data: [{ id: 'k9', context_length: 1000 }] });
  const caps = JSON.parse(model.capabilitiesJson!);
  assert.equal('vision' in caps, false);
  assert.equal('tools' in caps, false);
  assert.equal('reasoning' in caps, false);
  assert.deepEqual(caps.modalities, ['Text']);
});

test('malformed payloads are rejected instead of silently yielding nothing', () => {
  assert.throws(() => parseKimiModelPage(null), /必须是 JSON 对象/);
  assert.throws(() => parseKimiModelPage({}), /缺少 data 数组/);
  assert.throws(() => parseKimiModelPage({ data: [{}] }), /缺少有效模型 ID/);
  assert.throws(() => parseKimiModelPage({ data: ['nope'] }), /必须是对象/);
});
