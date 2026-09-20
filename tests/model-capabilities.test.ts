import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveModelCapabilities,
  resolveModelCapabilityStates,
} from '../lib/services/model-capabilities.ts';

test('no evidence yields "unknown", never an asserted capability', () => {
  // 一个完全陌生的模型：没有官方目录、没有规格字典命中。
  const states = resolveModelCapabilityStates('some-vendor-model-v9');
  for (const [id, state] of Object.entries(states)) {
    assert.equal(state, undefined, `${id} 在没有任何证据时不应给出结论`);
  }
  // 未知不渲染徽标——把推测显示成绿色的"支持"比不显示更糟。
  assert.deepEqual(resolveModelCapabilities('some-vendor-model-v9'), []);
});

test('an upstream enum list that omits a capability is negative evidence', () => {
  // 百炼返回了完整的 capabilities/features，缺席即"不支持"。
  const states = resolveModelCapabilityStates(
    'qwen3-max',
    JSON.stringify({ rawCapabilities: ['TG'], rawFeatures: ['cache'] }),
  );
  assert.equal(states.reasoning, false);
  assert.equal(states.tools, false);
  assert.equal(states.web_search, false);
  assert.equal(states.asr, false);
  // 该厂商没有给出任何模态信息，视觉仍是未知而不是不支持。
  assert.equal(states.vision, false); // capabilities 列表非空，构成否定证据
  // code 没有任何官方字段承载，永远保持未知。
  assert.equal(states.code, undefined);
});

test('model-name substrings no longer assert support on their own', () => {
  // 旧实现会因为"名字里没有 embedding"就断言支持工具调用。
  assert.equal(resolveModelCapabilityStates('gpt-4o-2024-11-20').tools, undefined);
  // "code" 子串噪声太大：codex / qwen3-coder 都会命中。
  assert.equal(resolveModelCapabilityStates('qwen3-coder-plus').code, undefined);
  assert.equal(resolveModelCapabilityStates('whisper-large-v3').asr, undefined);
  // 反证仍然保留：嵌入与重排模型确实不做工具调用。
  assert.equal(resolveModelCapabilityStates('text-embedding-v4').tools, false);
  assert.equal(resolveModelCapabilityStates('gte-rerank-v2').tools, false);
});

test('stored booleans and the official spec dictionary still win', () => {
  const stored = resolveModelCapabilityStates(
    'qwen-vl-max',
    JSON.stringify({ rawCapabilities: ['VU', 'TG'], vision: true, tools: true }),
  );
  assert.equal(stored.vision, true);
  assert.equal(stored.tools, true);

  // EXACT_MODEL_SPECS 覆盖：DeepSeek R1 官方明确不支持工具调用。
  const spec = resolveModelCapabilityStates('deepseek-reasoner');
  assert.equal(spec.reasoning, true);
  assert.equal(spec.tools, false);
  assert.equal(spec.vision, false);
});

test('a configured reasoning payload counts as evidence of reasoning', () => {
  assert.equal(resolveModelCapabilityStates('mystery-model', null, '{"levels":["low"]}').reasoning, true);
});

test('corrupt capability JSON degrades to unknown rather than unsupported', () => {
  assert.deepEqual(resolveModelCapabilityStates('mystery-model', '{not json').tools, undefined);
});
