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
  bailianAsrFamily,
  buildBailianAsrParameters,
  extractBailianAsrText,
  audioFormatFromName,
  supportsBailianVocabulary,
  realtimeSiblingFor,
} from '../lib/vendors/bailian/audio.ts';
import { buildFiletransInput } from '../lib/vendors/bailian/asr-filetrans.ts';
import { streamingModeFor, ttsFailureHint } from '../lib/vendors/bailian/tts-websocket.ts';

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

test('audio models route to the endpoint and protocol their family actually uses', () => {
  // Qwen-TTS 只有 HTTP：WebSocket 上查无此模型（Model not found）。
  for (const id of ['qwen-tts', 'qwen-tts-latest', 'qwen3-tts-flash', 'qwen3-tts-instruct-flash']) {
    assert.deepEqual(resolveBailianAudioRoute(id), { supported: true, kind: 'qwen-tts' }, id);
  }
  // 这三族反过来只有 WebSocket：HTTP 端点回 does not support http call。
  for (const id of ['cosyvoice-v2', 'cosyvoice-v3.5-flash', 'sambert-zhichu-v1', 'qwen-audio-3.0-tts-flash']) {
    assert.deepEqual(resolveBailianAudioRoute(id), { supported: true, kind: 'ws-tts' }, id);
  }
  assert.deepEqual(resolveBailianAudioRoute('qwen3-asr-flash-2026-02-10'), { supported: true, kind: 'asr' });
  assert.deepEqual(resolveBailianAudioRoute('qwen3-asr-flash-filetrans'), { supported: true, kind: 'asr-filetrans' });
  // qwen-audio-*-asr-* 名字里同时有 audio 和 tts 之外的关键词，不能被 ws-tts 抢走。
  assert.deepEqual(resolveBailianAudioRoute('qwen-audio-3.0-asr-flash'), { supported: true, kind: 'asr' });
});

test('realtime TTS gets its own protocol; realtime ASR is still refused locally', () => {
  // 实时 TTS 走协议 B（/api-ws/v1/realtime），与协议 A 互不相通：
  // 实测 qwen3-tts-flash-realtime 在协议 A 上是 Model not found。
  assert.deepEqual(resolveBailianAudioRoute('qwen3-tts-flash-realtime'), {
    supported: true,
    kind: 'realtime-tts',
  });
  assert.deepEqual(resolveBailianAudioRoute('qwen3-tts-instruct-flash-realtime'), {
    supported: true,
    kind: 'realtime-tts',
  });

  // 实时 ASR 要求客户端边推音频边收文字，一问一答的 HTTP 面承载不了。
  const asr = resolveBailianAudioRoute('qwen3-asr-flash-realtime-2026-02-10');
  assert.equal(asr.supported, false);
  assert.match(asr.supported === false ? asr.reason : '', /双向/);
});

test('the realtime sibling is offered as a hint, never substituted silently', () => {
  assert.equal(realtimeSiblingFor('qwen3-tts-flash'), 'qwen3-tts-flash-realtime');
  assert.equal(realtimeSiblingFor('bailian/qwen3-tts-instruct-flash'), 'qwen3-tts-instruct-flash-realtime');
  // 已经是实时模型的没有兄弟。
  assert.equal(realtimeSiblingFor('qwen3-tts-flash-realtime'), undefined);
  // cosyvoice / sambert 实测没有 -realtime 兄弟，别凭名字编一个出来。
  assert.equal(realtimeSiblingFor('cosyvoice-v3-flash'), undefined);
  assert.equal(realtimeSiblingFor('sambert-zhichu-v1'), undefined);
});

test('streaming mode differs by family, and getting it wrong is what upstream rejects', () => {
  // Sambert 不支持流式输入：文本必须随 run-task 一次发完，用 duplex 会得到
  // Request text is invalid!
  assert.equal(streamingModeFor('sambert-zhichu-v1'), 'out');
  assert.equal(streamingModeFor('cosyvoice-v2'), 'duplex');
  assert.equal(streamingModeFor('qwen-audio-3.0-tts-flash'), 'duplex');
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

test('Qwen-TTS goes over HTTP with its own voice table', async () => {
  const calls: any[] = [];
  const fetchImpl = (async (url: string, init?: any) => {
    // 音频下载那一跳也带 init（里面只有 signal），所以按 method 区分。
    if (init?.method !== 'POST') {
      return new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { 'Content-Type': 'audio/wav' } });
    }
    calls.push({ url, body: JSON.parse(init.body) });
    return new Response(
      JSON.stringify({ output: { audio: { url: 'https://example.invalid/a.wav' } }, usage: { characters: 5 } }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as unknown as typeof fetch;

  await callBailianTts({ workspaceId: 'ws-test' } as never, 'sk-test', { model: 'qwen3-tts-flash', text: '你好' }, fetchImpl);

  assert.match(calls[0].url, /multimodal-generation\/generation$/);
  // Cherry 是 Qwen-TTS 的音色；传 CosyVoice 的 longxiaochun_v2 会被回 418。
  assert.equal(calls[0].body.input.voice, 'Cherry');
  assert.equal(calls[0].body.input.format, undefined, 'Qwen-TTS 的请求体不收 format');
});

test('WebSocket-only families synthesize over the socket, with per-version voices', async () => {
  const sent: any[] = [];
  const connect = () => {
    const listeners: Record<string, ((e: any) => void)[]> = {};
    const socket = {
      send: (data: string) => {
        const msg = JSON.parse(data);
        sent.push(msg);
        if (msg.header.action === 'run-task') {
          queueMicrotask(() => listeners.message?.forEach((f) => f({ data: JSON.stringify({ header: { event: 'task-started' } }) })));
        }
        if (msg.header.action === 'finish-task' || (msg.header.action === 'run-task' && msg.header.streaming === 'out')) {
          queueMicrotask(() => {
            listeners.message?.forEach((f) => f({ data: new Uint8Array([9, 9, 9]).buffer }));
            listeners.message?.forEach((f) =>
              f({ data: JSON.stringify({ header: { event: 'task-finished' }, payload: { usage: { characters: 4 } } }) }),
            );
          });
        }
      },
      close: () => {},
      addEventListener: (type: string, fn: (e: any) => void) => {
        (listeners[type] ??= []).push(fn);
        if (type === 'open') queueMicrotask(() => fn({}));
      },
    };
    return socket as never;
  };

  const provider = { workspaceId: 'ws-test' } as never;
  const cosy = await callBailianTts(provider, 'sk-test', { model: 'cosyvoice-v2', text: '你好', connect });
  assert.equal(cosy.audioBuffer?.length, 3);
  assert.equal(cosy.characters, 4);
  // v1/v2 用 _v2 后缀那套音色，v3 起用无后缀那套；互换会被回 418。
  assert.equal(sent[0].payload.parameters.voice, 'longxiaochun_v2');
  assert.equal(sent[0].header.streaming, 'duplex');

  sent.length = 0;
  await callBailianTts(provider, 'sk-test', { model: 'cosyvoice-v3-flash', text: '你好', connect });
  assert.equal(sent[0].payload.parameters.voice, 'longanhuan');

  sent.length = 0;
  await callBailianTts(provider, 'sk-test', { model: 'sambert-zhichu-v1', text: '你好', connect });
  assert.equal(sent[0].header.streaming, 'out');
  // Sambert 没有 voice 参数——模型名本身就是音色。
  assert.equal(sent[0].payload.parameters.voice, undefined);
  // 文本必须随 run-task 一次发完，不能等 continue-task。
  assert.equal(sent[0].payload.input.text, '你好');
  assert.ok(!sent.some((m) => m.header.action === 'continue-task'));
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

test('voice-clone and voice-design models explain what they need instead of echoing a vague error', async () => {
  // 官方简介明写这两族只合成专门服务复刻/设计出来的声音，预置音色一定失败，
  // 而上游只回一句「please verify your input」，对着它是猜不出来的。
  const fetchImpl = (async () =>
    new Response(
      '{"code":"InvalidParameter","message":"TTS speak request failed, please verify your input."}',
      { status: 400 },
    )) as unknown as typeof fetch;

  await assert.rejects(
    () => callBailianTts({ workspaceId: 'ws' } as never, 'sk', { model: 'qwen3-tts-vc-2026-01-22', text: 'x' }, fetchImpl),
    (e: any) => e.status === 400 && /qwen-voice-enrollment/.test(e.message),
  );
  await assert.rejects(
    () => callBailianTts({ workspaceId: 'ws' } as never, 'sk', { model: 'qwen3-tts-vd-2026-01-26', text: 'x' }, fetchImpl),
    (e: any) => e.status === 400 && /qwen3-voice-design/.test(e.message),
  );
});

test('a 418 explains the voice table is per model version', () => {
  assert.match(
    ttsFailureHint('cosyvoice-v2', 'longanhuan', 'Engine return error code: 418'),
    /_v2 后缀/,
  );
  assert.match(
    ttsFailureHint('cosyvoice-v3-flash', 'longxiaochun_v2', 'Engine return error code: 418'),
    /不带版本后缀/,
  );
  // 与音色无关的报错不要硬塞提示。
  assert.equal(ttsFailureHint('cosyvoice-v2', 'longxiaochun_v2', 'some unrelated failure'), '');
});

test('ASR always sends a parameters object, and the two families get different ones', () => {
  // 少了 parameters.format，workspace 专有域名回的是空的 `400 {}`——
  // 看不出任何线索，公共域名才说 `UNSUPPORTED_FORMAT format is empty`。
  assert.equal(bailianAsrFamily('qwen3-asr-flash'), 'qwen3');
  assert.equal(bailianAsrFamily('qwen-audio-3.0-asr-flash'), 'vocabulary');
  assert.equal(bailianAsrFamily('fun-asr'), 'vocabulary');
  // 路由层看到的是带服务商前缀的名字——漏剥前缀会把 qwen3 误判成支持热词。
  assert.equal(bailianAsrFamily('bailian/qwen3-asr-flash'), 'qwen3');
  assert.equal(supportsBailianVocabulary('bailian/qwen3-asr-flash'), false);
  assert.equal(supportsBailianVocabulary('bailian/qwen-audio-3.0-asr-flash'), true);

  const vocabParams = buildBailianAsrParameters({
    model: 'qwen-audio-3.0-asr-flash',
    audioDataUriOrUrl: 'data:audio/wav;base64,AA',
    vocabulary: { 小单: 5 },
    languageHints: ['zh', 'en'],
  });
  assert.equal(vocabParams.format, 'wav', 'format 必填，缺省也得给');
  assert.deepEqual(vocabParams.vocabulary, { 小单: 5 });
  assert.deepEqual(vocabParams.language_hints, ['zh', 'en'], '复数键，且不只取第一个');
  assert.equal('asr_options' in vocabParams, false);

  const qwen3Params = buildBailianAsrParameters({
    model: 'qwen3-asr-flash',
    audioDataUriOrUrl: 'data:audio/wav;base64,AA',
    vocabulary: { 小单: 5 },
    languageHints: ['zh'],
  });
  // qwen3-asr 官方规格「热词=否」，实测传了也不生效，所以根本不往上发。
  assert.equal('vocabulary' in qwen3Params, false);
  assert.deepEqual(qwen3Params.asr_options, { enable_lid: true, language: 'zh' });
});

test('ASR accepts all three response shapes upstream actually returns', () => {
  assert.equal(extractBailianAsrText({ output: { choices: [{ message: { content: [{ text: '甲' }, { text: '乙' }] } }] } }), '甲乙');
  assert.equal(extractBailianAsrText({ output: { choices: [{ message: { content: '整串' } }] } }), '整串');
  assert.equal(extractBailianAsrText({ output: { sentence: { text: '分句' } } }), '分句');
  assert.equal(extractBailianAsrText({ output: { text: '平铺' } }), '平铺');
  assert.equal(extractBailianAsrText({ output: { choices: [{ message: { content: [] } }] } }), '');
});

test('the ASR context turn is a system message, because user is rejected upstream', async () => {
  let captured: any;
  const fetchImpl = (async (_url: string, init: any) => {
    captured = JSON.parse(init.body);
    return new Response(JSON.stringify({ output: { text: '好' } }), { status: 200 });
  }) as unknown as typeof fetch;

  await callBailianAsr(
    { workspaceId: null } as never,
    'sk-test',
    {
      model: 'qwen3-asr-flash',
      audioDataUriOrUrl: 'data:audio/wav;base64,AA',
      contextMessages: [{ role: 'system', text: '小单' }],
    },
    fetchImpl,
  );

  // user 角色会被上游拒：`The dedicated task 'asr' ... does not support this input.`
  assert.equal(captured.input.messages[0].role, 'system');
  assert.deepEqual(captured.input.messages[0].content, [{ text: '小单' }]);
});

test('audio format is inferred from mime or filename, and unknown stays unknown', () => {
  assert.equal(audioFormatFromName('audio/wav'), 'wav');
  assert.equal(audioFormatFromName('audio/mpeg'), 'mp3');
  assert.equal(audioFormatFromName('audio/L16'), 'pcm');
  assert.equal(audioFormatFromName('application/octet-stream', 'clip.m4a'), 'm4a');
  // 编一个上游不认识的格式串比让调用方决定缺省更糟。
  assert.equal(audioFormatFromName('application/octet-stream', 'clip.bin'), undefined);
});

test('filetrans uses a different input field per family, and swapping them fails upstream', () => {
  assert.deepEqual(buildFiletransInput('qwen3-asr-flash-filetrans', 'https://x/a.wav'), {
    file_url: 'https://x/a.wav',
  });
  // 传单数给这一族，上游回的是 InvalidParameter.ParseError——看不出是字段名的问题。
  assert.deepEqual(buildFiletransInput('qwen-audio-3.0-asr-flash-filetrans', 'https://x/a.wav'), {
    file_urls: ['https://x/a.wav'],
  });
});

test('a 411 names the one voice qwen-audio actually accepts', () => {
  const hint = ttsFailureHint('qwen-audio-3.0-tts-flash', 'Cherry', '[cosyvoice:]Engine error [411]');
  assert.match(hint, /longanlingxi/);
  assert.match(hint, /Cherry/);
  // 3.1 实测 20 个候选音色全拒、连不传都拒，提示要指向复刻音色而不是某个预置音色。
  const hint31 = ttsFailureHint('qwen-audio-3.1-tts-flash', undefined, '[cosyvoice:]Engine error [411]');
  assert.match(hint31, /voice-enrollment|克隆/);
  assert.equal(ttsFailureHint('cosyvoice-v3-flash', 'longanhuan', 'some other failure'), '');
});
