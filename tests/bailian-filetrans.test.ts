import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bailianFiletransSubmitUrl,
  bailianTaskUrl,
  extractFiletransText,
  callBailianFiletrans,
} from '../lib/vendors/bailian/asr-filetrans.ts';

// 契约 2026-09-20 用真实密钥实测：提交 → 轮询 /api/v1/tasks/{id} → 下载 transcription_url。

const provider = { workspaceId: 'ws-test' };
const noSleep = () => Promise.resolve();

test('endpoints follow the workspace host, falling back to the shared one', () => {
  assert.equal(
    bailianFiletransSubmitUrl('ws-test'),
    'https://ws-test.cn-beijing.maas.aliyuncs.com/api/v1/services/audio/asr/transcription',
  );
  assert.equal(
    bailianFiletransSubmitUrl(null),
    'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
  );
  assert.equal(bailianTaskUrl('ws-test', 'abc/1'), 'https://ws-test.cn-beijing.maas.aliyuncs.com/api/v1/tasks/abc%2F1');
});

test('multi-channel transcripts join in channel order', () => {
  const { text, transcripts } = extractFiletransText({
    transcripts: [{ channel_id: 0, text: '你好' }, { channel_id: 1, text: '世界' }],
  });
  assert.equal(text, '你好\n世界');
  assert.equal(transcripts.length, 2);
});

test('submit carries the async header and polling stops at SUCCEEDED', async () => {
  const seen: Array<{ url: string; async?: string }> = [];
  let polls = 0;
  const fetchImpl = (async (url: string, init?: any) => {
    seen.push({ url, async: init?.headers?.['X-DashScope-Async'] });
    if (url.includes('/asr/transcription')) {
      return Response.json({ output: { task_id: 'task-1' } });
    }
    if (url.includes('/api/v1/tasks/')) {
      polls += 1;
      // 头两次还在跑，第三次才成功——轮询必须能等。
      if (polls < 3) return Response.json({ output: { task_status: 'RUNNING' } });
      return Response.json({
        output: { task_status: 'SUCCEEDED', result: { transcription_url: 'https://example.invalid/r.json' } },
      });
    }
    return Response.json({ transcripts: [{ text: 'hello world' }] });
  }) as unknown as typeof fetch;

  const result = await callBailianFiletrans(
    provider,
    'sk-test',
    { model: 'qwen3-asr-flash-filetrans', fileUrl: 'https://example.invalid/a.wav', sleep: noSleep },
    fetchImpl,
  );

  assert.equal(result.text, 'hello world');
  assert.equal(result.taskId, 'task-1');
  assert.equal(polls, 3);
  // 缺这个头会被当成同步调用而报错。
  assert.equal(seen[0].async, 'enable');
});

test('a FAILED task surfaces upstream reason as a 4xx, not a gateway failure', async () => {
  const fetchImpl = (async (url: string) => {
    if (url.includes('/asr/transcription')) return Response.json({ output: { task_id: 't' } });
    return Response.json({ output: { task_status: 'FAILED', message: 'file download error' } });
  }) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      callBailianFiletrans(
        provider,
        'sk-test',
        { model: 'qwen3-asr-flash-filetrans', fileUrl: 'https://example.invalid/a.wav', sleep: noSleep },
        fetchImpl,
      ),
    (e: any) => e.status === 400 && /file download error/.test(e.message),
  );
});

test('polling gives up rather than looping forever', async () => {
  let clock = 0;
  const fetchImpl = (async (url: string) => {
    if (url.includes('/asr/transcription')) return Response.json({ output: { task_id: 't' } });
    clock += 10_000;
    return Response.json({ output: { task_status: 'RUNNING' } });
  }) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      callBailianFiletrans(
        provider,
        'sk-test',
        {
          model: 'qwen3-asr-flash-filetrans',
          fileUrl: 'https://example.invalid/a.wav',
          sleep: noSleep,
          now: () => clock,
          timeoutMs: 30_000,
        },
        fetchImpl,
      ),
    (e: any) => e.status === 504,
  );
});

test('a successful task with no result URL is reported rather than returning empty text', async () => {
  const fetchImpl = (async (url: string) => {
    if (url.includes('/asr/transcription')) return Response.json({ output: { task_id: 't' } });
    return Response.json({ output: { task_status: 'SUCCEEDED' } });
  }) as unknown as typeof fetch;

  await assert.rejects(
    () =>
      callBailianFiletrans(
        provider,
        'sk-test',
        { model: 'qwen3-asr-flash-filetrans', fileUrl: 'https://example.invalid/a.wav', sleep: noSleep },
        fetchImpl,
      ),
    (e: any) => e.status === 502,
  );
});
