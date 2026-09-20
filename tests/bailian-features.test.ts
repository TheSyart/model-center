import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bailianCatalogUrl,
  BAILIAN_PROVIDERS,
  BAILIAN_CAPABILITIES,
  type BailianCatalogFilterOptions,
} from '../lib/vendors/bailian/catalog.ts';
import { resolveModelCapabilities } from '../lib/services/model-capabilities.ts';
import {
  isBailianAsrModel,
  isBailianTtsModel,
  resolveBailianAudioRoute,
  getBailianMultimodalEndpoint,
  getBailianSpeechSynthesizerEndpoint,
  callBailianAsr,
  callBailianTts,
} from '../lib/vendors/bailian/audio.ts';

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
    getBailianMultimodalEndpoint('ws-test'),
    'https://ws-test.cn-beijing.maas.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  );
  assert.equal(
    getBailianMultimodalEndpoint(null),
    'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation'
  );
  assert.equal(
    getBailianSpeechSynthesizerEndpoint('ws-test'),
    'https://ws-test.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
  );
  assert.equal(
    getBailianSpeechSynthesizerEndpoint(null),
    'https://dashscope.aliyuncs.com/api/v1/services/audio/tts/SpeechSynthesizer'
  );
});

// 以下契约于 2026-09-20 用真实密钥逐条实测，详见 docs/vendor-apis/bailian.md。

test('audio models route to the endpoint their family actually uses', () => {
  // Qwen-TTS 在多模态生成端点上；发到 SpeechSynthesizer 会被回 url error。
  for (const id of ['qwen-tts', 'qwen-tts-latest', 'qwen3-tts-flash', 'qwen3-tts-instruct-flash']) {
    assert.deepEqual(resolveBailianAudioRoute(id), { supported: true, kind: 'qwen-tts' }, id);
  }
  // CosyVoice / Sambert 才在 SpeechSynthesizer。
  for (const id of ['cosyvoice-v3.5-flash', 'cosyvoice-v3.5-plus', 'sambert-zhichu-v1']) {
    assert.deepEqual(resolveBailianAudioRoute(id), { supported: true, kind: 'legacy-tts' }, id);
  }
  assert.deepEqual(resolveBailianAudioRoute('qwen3-asr-flash-2026-02-10'), { supported: true, kind: 'asr' });
});

test('models that HTTP cannot serve are refused locally with a reason', () => {
  // 实测回 `current user api does not support http call`，没必要白跑一趟上游。
  const realtime = resolveBailianAudioRoute('qwen3-tts-flash-realtime');
  assert.equal(realtime.supported, false);
  assert.match(realtime.supported === false ? realtime.reason : '', /WebSocket/);

  // 录音文件转写是另一套异步接口。
  const filetrans = resolveBailianAudioRoute('qwen3-asr-flash-filetrans');
  assert.equal(filetrans.supported, false);
  assert.match(filetrans.supported === false ? filetrans.reason : '', /异步/);

  // realtime 判定优先于 asr/tts 归类，否则会被当成普通模型发出去。
  assert.equal(resolveBailianAudioRoute('qwen3-asr-flash-realtime-2026-02-10').supported, false);
});

test('ASR sends content[].audio, not the OpenAI input_audio shape', async () => {
  let captured: any;
  const fetchImpl = (async (url: string, init: any) => {
    captured = { url, body: JSON.parse(init.body) };
    return new Response(
      JSON.stringify({
        output: { choices: [{ message: { content: [{ text: '验收通过' }] } }] },
        usage: { seconds: 2 },
        request_id: 'req-1',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;

  const provider = { workspaceId: 'ws-test' } as never;
  const result = await callBailianAsr(
    provider,
    'sk-test',
    { model: 'qwen3-asr-flash', audioDataUriOrUrl: 'data:audio/wav;base64,AAAA' },
    fetchImpl,
  );

  assert.match(captured.url, /multimodal-generation\/generation$/);
  // 这正是此前发错、被上游拒的地方：
  // `Input should be a valid string: input.messages.0.content.str`
  assert.deepEqual(captured.body.input.messages, [
    { role: 'user', content: [{ audio: 'data:audio/wav;base64,AAAA' }] },
  ]);
  assert.equal(result.text, '验收通过');
  assert.equal(result.seconds, 2);
});

test('Qwen-TTS and CosyVoice get different endpoints, bodies and default voices', async () => {
  const calls: any[] = [];
  const fetchImpl = (async (url: string, init?: any) => {
    // 音频下载那一跳也带 init（里面只有 signal），所以按 method 区分，不能只看 init 有没有。
    if (init?.method !== 'POST') {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    }
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(
      JSON.stringify({ output: { audio: { url: 'https://example.invalid/a.wav' } }, usage: { characters: 5 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;

  const provider = { workspaceId: 'ws-test' } as never;
  await callBailianTts(provider, 'sk-test', { model: 'qwen3-tts-flash', text: '你好' }, fetchImpl);
  await callBailianTts(provider, 'sk-test', { model: 'cosyvoice-v3.5-flash', text: '你好' }, fetchImpl);

  assert.match(calls[0].url, /multimodal-generation\/generation$/);
  // Cherry 是 Qwen-TTS 的音色；传 CosyVoice 的 longxiaochun_v3 会被回 Invalid voice specified。
  assert.equal(calls[0].body.input.voice, 'Cherry');
  assert.equal(calls[0].body.input.format, undefined, 'Qwen-TTS 的请求体不收 format');

  assert.match(calls[1].url, /audio\/tts\/SpeechSynthesizer$/);
  assert.equal(calls[1].body.input.voice, 'longxiaochun_v3');
  assert.equal(calls[1].body.input.format, 'wav');
});

test('TTS reports the audio type it actually received, not the one requested', async () => {
  const fetchImpl = (async (url: string, init?: any) => {
    if (!init || init.method !== 'POST') {
      return new Response(new Uint8Array([1]), { status: 200, headers: { 'Content-Type': 'audio/x-wav' } });
    }
    return new Response(
      JSON.stringify({ output: { audio: { url: 'https://example.invalid/a.wav' } } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;

  // 客户端要 mp3，但 Qwen-TTS 不收 format、实际给的是 WAV。
  const res = await callBailianTts(
    { workspaceId: 'ws-test' } as never,
    'sk-test',
    { model: 'qwen3-tts-flash', text: '你好', format: 'mp3' },
    fetchImpl,
  );
  assert.equal(res.contentType, 'audio/x-wav');
});

test('an upstream non-2xx carries its status instead of becoming a gateway failure', async () => {
  const fetchImpl = (async () =>
    new Response('{"code":"InvalidParameter"}', { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    () =>
      callBailianAsr(
        { workspaceId: 'ws-test' } as never,
        'sk-test',
        { model: 'qwen3-asr-flash', audioDataUriOrUrl: 'data:audio/wav;base64,AA' },
        fetchImpl,
      ),
    (e: any) => e.status === 400 && /InvalidParameter/.test(e.message),
  );
});
