import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBailianVoice,
  deleteBailianVoice,
  getBailianVoice,
  listBailianVoices,
  needsOssUpload,
  voiceApiFor,
  DEFAULT_PREVIEW_TEXT,
} from '../lib/vendors/bailian/voices.ts';
import { isUpstreamError } from '../lib/upstream-error.ts';

const provider = { workspaceId: 'ws-test' } as never;

function recorder(response: unknown, status = 200) {
  const calls: any[] = [];
  const fetchImpl = (async (url: string, init: any) => {
    calls.push({ url, headers: init.headers, body: init.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify(response), { status, headers: { 'Content-Type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

test('the target model picks which of the two upstream APIs is used', () => {
  // 传错的表现是 `Model not exist.` 或一个空的 400，都看不出是 model 字段的问题。
  assert.equal(voiceApiFor('cosyvoice-v3-flash'), 'voice-enrollment');
  assert.equal(voiceApiFor('qwen-audio-3.1-tts-flash'), 'voice-enrollment');
  assert.equal(voiceApiFor('qwen3-tts-vc-2026-01-22'), 'qwen-voice-enrollment');
  assert.equal(voiceApiFor('bailian/qwen3-tts-vd-2026-01-26'), 'qwen-voice-enrollment');
  // qwen3-tts-flash 不是 vc/vd，别被前缀骗了。
  assert.equal(voiceApiFor('qwen3-tts-flash'), 'voice-enrollment');
});

test('cloning uses each API own field names', async () => {
  const enrollment = recorder({ output: { voice_id: 'cosyvoice-v3-flash-mc-abc' } });
  const a = await createBailianVoice(
    provider,
    'sk-test',
    { targetModel: 'cosyvoice-v3-flash', name: 'mc', audioUrl: 'https://x/a.wav', languageHints: ['zh'] },
    enrollment.fetchImpl,
  );
  assert.deepEqual(enrollment.calls[0].body, {
    model: 'voice-enrollment',
    input: {
      action: 'create_voice',
      target_model: 'cosyvoice-v3-flash',
      prefix: 'mc',
      url: 'https://x/a.wav',
      language_hints: ['zh'],
    },
  });
  assert.equal(a.id, 'cosyvoice-v3-flash-mc-abc');

  const qwen = recorder({ output: { voice: 'qwen-tts-vc-mc-xyz', target_model: 'qwen3-tts-vc-2026-01-22' } });
  const b = await createBailianVoice(
    provider,
    'sk-test',
    { targetModel: 'qwen3-tts-vc-2026-01-22', name: 'mc', audioUrl: 'data:audio/wav;base64,AA' },
    qwen.fetchImpl,
  );
  // 另一套：model、动作名、名字字段、音频字段、返回字段，没有一个相同。
  assert.deepEqual(qwen.calls[0].body, {
    model: 'qwen-voice-enrollment',
    input: {
      action: 'create',
      target_model: 'qwen3-tts-vc-2026-01-22',
      preferred_name: 'mc',
      audio: { data: 'data:audio/wav;base64,AA' },
    },
  });
  assert.equal(b.id, 'qwen-tts-vc-mc-xyz');
});

test('an oss:// sample carries the header that makes upstream resolve it', async () => {
  const withOss = recorder({ output: { voice_id: 'v1' } });
  await createBailianVoice(
    provider,
    'sk-test',
    { targetModel: 'cosyvoice-v3-flash', name: 'mc', audioUrl: 'oss://bucket/key.wav' },
    withOss.fetchImpl,
  );
  assert.equal(withOss.calls[0].headers['X-DashScope-OssResourceResolve'], 'enable');

  const httpsOnly = recorder({ output: { voice_id: 'v2' } });
  await createBailianVoice(
    provider,
    'sk-test',
    { targetModel: 'cosyvoice-v3-flash', name: 'mc', audioUrl: 'https://x/a.wav' },
    httpsOnly.fetchImpl,
  );
  assert.equal('X-DashScope-OssResourceResolve' in httpsOnly.calls[0].headers, false);
});

test('voice design always sends preview_text, because upstream needs both', async () => {
  const r = recorder({ output: { voice_id: 'vd-1', preview_audio: { data: 'QUJD' } } });
  const voice = await createBailianVoice(
    provider,
    'sk-test',
    { targetModel: 'cosyvoice-v3.5-flash', name: 'mc', prompt: '低沉温和的中年男声', previewText: '你好，我是小单，很高兴认识你' },
    r.fetchImpl,
  );
  assert.equal(r.calls[0].body.input.voice_prompt, '低沉温和的中年男声');
  assert.equal(r.calls[0].body.input.preview_text, '你好，我是小单，很高兴认识你');
  assert.deepEqual(r.calls[0].body.parameters, { sample_rate: 24000, response_format: 'wav' });
  assert.deepEqual(voice.preview, { data: 'QUJD', contentType: 'audio/wav' });

  // 不给 preview_text 也要补上——只给描述，上游回
  // `provide url, or provide both voice_prompt and preview_text`。
  const bare = recorder({ output: { voice_id: 'vd-2' } });
  await createBailianVoice(
    provider,
    'sk-test',
    { targetModel: 'cosyvoice-v3.5-flash', name: 'mc', prompt: '低沉温和的中年男声' },
    bare.fetchImpl,
  );
  assert.equal(bare.calls[0].body.input.preview_text, DEFAULT_PREVIEW_TEXT);
  // 缺省句必须够长：短于 15 字上游同样会拒。
  assert.ok(DEFAULT_PREVIEW_TEXT.length >= 15);
});

const MIXED_LIST = {
  output: {
    page_index: 0,
    page_size: 50,
    total_count: 3,
    voice_list: [
      { voice_id: 'a', target_model: 'cosyvoice-v3-plus', status: 'OK', gmt_create: '2026-01-06 15:24:14' },
      { voice_id: 'b', target_model: 'cosyvoice-v3-flash', status: 'OK', gmt_create: '2026-02-02 10:00:00' },
      { voice_id: 'c', target_model: 'qwen-audio-3.0-tts-flash', status: 'OK' },
    ],
  },
};

test('listing keeps only the voices usable with the requested model', async () => {
  // 上游的 list_voice 没有按目标模型过滤的参数——prefix 匹配的是创建时给的名字段，
  // 不是模型名。不自己筛，调用方会拿到一批绑在别的模型上、要到合成时才报 400 的音色。
  const r = recorder(MIXED_LIST);
  const page = await listBailianVoices(provider, 'sk-test', { targetModel: 'cosyvoice-v3-flash' }, r.fetchImpl);
  assert.equal(r.calls[0].body.input.action, 'list_voice');
  assert.deepEqual(page.voices.map((v) => v.id), ['b']);
  assert.deepEqual(page.voices[0], {
    id: 'b',
    targetModel: 'cosyvoice-v3-flash',
    status: 'OK',
    createdAt: '2026-02-02 10:00:00',
    updatedAt: undefined,
    preview: null,
  });
  // 过滤之后的条数，不是上游那个包含所有模型的总数。
  assert.equal(page.totalCount, 1);

  // 带服务商前缀的模型名也要能对上。
  const prefixed = recorder(MIXED_LIST);
  const p2 = await listBailianVoices(provider, 'sk-test', { targetModel: 'bailian/qwen-audio-3.0-tts-flash' }, prefixed.fetchImpl);
  assert.deepEqual(p2.voices.map((v) => v.id), ['c']);
});

test('all_models opts out of the filter and passes pagination straight through', async () => {
  const r = recorder(MIXED_LIST);
  const page = await listBailianVoices(
    provider,
    'sk-test',
    { targetModel: 'cosyvoice-v3-flash', includeAllModels: true, pageIndex: 0, pageSize: 2 },
    r.fetchImpl,
  );
  assert.deepEqual(page.voices.map((v) => v.id), ['a', 'b', 'c']);
  assert.equal(page.totalCount, 3, '不过滤时沿用上游的总数');
  assert.equal(r.calls[0].body.input.page_size, 2);
});

test('the qwen listing has no target_model, so it is attributed to the queried model', async () => {
  const qwen = recorder({ output: { voice_list: [{ voice: 'q1' }], total_count: 1 } });
  const qpage = await listBailianVoices(provider, 'sk-test', { targetModel: 'qwen3-tts-vc-2026-01-22' }, qwen.fetchImpl);
  assert.equal(qwen.calls[0].body.input.action, 'list');
  assert.equal(qpage.voices[0].id, 'q1');
  // 那一套 API 本来就只服务 vc 一族，缺字段不代表不匹配。
  assert.equal(qpage.voices[0].targetModel, 'qwen3-tts-vc-2026-01-22');
});

test('the qwen API has no single-voice query, so it falls back to the listing', async () => {
  const r = recorder({ output: { voice_list: [{ voice: 'want-me' }, { voice: 'other' }] } });
  const voice = await getBailianVoice(
    provider,
    'sk-test',
    { targetModel: 'qwen3-tts-vc-2026-01-22', voiceId: 'want-me' },
    r.fetchImpl,
  );
  assert.equal(r.calls[0].body.input.action, 'list');
  assert.equal(voice.id, 'want-me');

  const missing = recorder({ output: { voice_list: [] } });
  await assert.rejects(
    () => getBailianVoice(provider, 'sk-test', { targetModel: 'qwen3-tts-vc-2026-01-22', voiceId: 'nope' }, missing.fetchImpl),
    (e: unknown) => isUpstreamError(e) && (e as any).status === 404,
  );
});

test('deleting uses each API own id field', async () => {
  const enrollment = recorder({ output: {} });
  await deleteBailianVoice(provider, 'sk-test', { targetModel: 'cosyvoice-v3-flash', voiceId: 'v1' }, enrollment.fetchImpl);
  assert.deepEqual(enrollment.calls[0].body.input, { action: 'delete_voice', voice_id: 'v1' });

  const qwen = recorder({ output: {} });
  await deleteBailianVoice(provider, 'sk-test', { targetModel: 'qwen3-tts-vc-2026-01-22', voiceId: 'q1' }, qwen.fetchImpl);
  assert.deepEqual(qwen.calls[0].body.input, { action: 'delete', voice: 'q1' });
});

test('an empty error body from the workspace domain is explained, not echoed as blank', async () => {
  const fetchImpl = (async () => new Response('', { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    () => createBailianVoice(provider, 'sk-test', { targetModel: 'cosyvoice-v3-flash', name: 'mc', audioUrl: 'https://x/a.wav' }, fetchImpl),
    // workspace 专有域名会把错误体清空——ASR 上已经踩过一次，这里把它说出来。
    (e: unknown) => isUpstreamError(e) && /workspace 专有域名/.test((e as any).message),
  );
});

test('only the url-only API needs the OSS upload hop', () => {
  // qwen-voice-enrollment 的 audio.data 直接收 base64 data URI，省掉一整趟上传。
  assert.equal(needsOssUpload('cosyvoice-v3-flash'), true);
  assert.equal(needsOssUpload('qwen3-tts-vc-2026-01-22'), false);
});
