import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bailianCatalogUrl,
  BAILIAN_PROVIDERS,
  BAILIAN_CAPABILITIES,
  type BailianCatalogFilterOptions,
} from '../lib/vendors/bailian/catalog.ts';
import { resolveModelCapabilities } from '../lib/services/model-capabilities.ts';
import { isBailianAsrModel, isBailianTtsModel, getBailianAsrEndpoint, getBailianTtsEndpoint } from '../lib/vendors/bailian/audio.ts';

test('bailianCatalogUrl serializes query parameters correctly according to official docs', () => {
  const filter: BailianCatalogFilterOptions = {
    providers: ['qwen', 'deepseek'],
    capabilities: ['TG', 'Reasoning', 'ASR'],
    features: ['function-calling'],
    language: 'zh-CN',
  };

  const url = new URL(bailianCatalogUrl('ws-123456', 2, 20, filter));
  assert.equal(url.hostname, 'ws-123456.cn-beijing.maas.aliyuncs.com');
  assert.equal(url.pathname, '/api/v1/models');
  assert.equal(url.searchParams.get('page_no'), '2');
  assert.equal(url.searchParams.get('page_size'), '20');
  assert.equal(url.searchParams.get('language'), 'zh-CN');

  const providers = url.searchParams.getAll('providers');
  assert.deepEqual(providers, ['qwen', 'deepseek']);

  const caps = url.searchParams.getAll('capabilities');
  assert.deepEqual(caps, ['TG', 'Reasoning', 'ASR']);

  const feats = url.searchParams.getAll('features');
  assert.deepEqual(feats, ['function-calling']);
});

test('resolveModelCapabilities extracts vision, tools, reasoning, asr, tts and web_search', () => {
  // 1. 纯文本 + 工具 + 思考
  const tags1 = resolveModelCapabilities('qwen3-max', JSON.stringify({
    rawCapabilities: ['TG', 'Reasoning'],
    rawFeatures: ['function-calling', 'web-search'],
  }));
  assert.ok(tags1.some((t) => t.id === 'reasoning'));
  assert.ok(tags1.some((t) => t.id === 'tools'));
  assert.ok(tags1.some((t) => t.id === 'web_search'));

  // 2. 视觉模型
  const tags2 = resolveModelCapabilities('qwen-vl-max', JSON.stringify({
    rawCapabilities: ['VU', 'TG'],
  }));
  assert.ok(tags2.some((t) => t.id === 'vision'));

  // 3. 语音识别模型 (ASR)
  const tags3 = resolveModelCapabilities('qwen-audio-3.0-asr-flash', JSON.stringify({
    rawCapabilities: ['ASR'],
  }));
  assert.ok(tags3.some((t) => t.id === 'asr'));
  assert.ok(isBailianAsrModel('qwen-audio-3.0-asr-flash'));

  // 4. 语音合成模型 (TTS)
  const tags4 = resolveModelCapabilities('cosyvoice-v3.5-flash', JSON.stringify({
    rawCapabilities: ['TTS'],
  }));
  assert.ok(tags4.some((t) => t.id === 'tts'));
  assert.ok(isBailianTtsModel('cosyvoice-v3.5-flash'));
});

test('dashscope audio endpoints calculate workspace domain or fallback domain correctly', () => {
  assert.equal(
    getBailianAsrEndpoint('ws-test'),
    'https://ws-test.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  );
  assert.equal(
    getBailianAsrEndpoint(null),
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  );
  assert.equal(
    getBailianTtsEndpoint('ws-test'),
    'https://ws-test.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
  );
  assert.equal(
    getBailianTtsEndpoint(null),
    'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
  );
});
