import { bailianAsrFamily } from './audio.ts';
import { UpstreamError } from '../../upstream-error.ts';

/**
 * 百炼录音文件转写（`*-filetrans` 模型）。
 *
 * 与同步 ASR 是两套流程：这里是「提交任务 → 轮询状态 → 下载结果」，提交时必须带
 * `X-DashScope-Async: enable`，转写文本不在轮询响应里，而在一个要另行下载的 URL 后面。
 *
 * **只接受公网可访问的音频 URL**，不收 base64——这是接口本身的限制，不是网关的。
 *
 * 契约 2026-09-20 实测：提交后 1 次轮询即 SUCCEEDED，结果 JSON 的
 * `transcripts[].text` 是整段文字，`sentences[]` 带分句时间戳。
 */

const DEFAULT_POLL_INTERVAL_MS = 1_500;
const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * 两族的输入字段名不一样，传错就失败，**且错误信息看不出是字段名的问题**：
 *
 * | 模型 | 字段 | 传错时上游的回应 |
 * |---|---|---|
 * | `qwen3-asr-flash-filetrans` | `input.file_url`（单数字符串） | `InvalidParameter.MalformedURL` |
 * | `qwen-audio-3.0-asr-flash-filetrans` | `input.file_urls`（复数数组） | `InvalidParameter.ParseError` |
 *
 * 2026-09-20 实测，两边互换均失败、按本表则均成功。
 */
export function buildFiletransInput(model: string, fileUrl: string): Record<string, unknown> {
  return bailianAsrFamily(model) === 'qwen3' ? { file_url: fileUrl } : { file_urls: [fileUrl] };
}

export interface BailianFiletransOptions {
  model: string;
  /** 公网可访问的音频地址。 */
  fileUrl: string;
  /** 只转写指定声道，缺省全部。 */
  channelIds?: number[];
  /** 热词：词 → 权重（1-5）。qwen-audio / fun-asr 族支持。 */
  vocabulary?: Record<string, number>;
  vocabularyId?: string;
  languageHints?: string[];
  signal?: AbortSignal;
  pollIntervalMs?: number;
  timeoutMs?: number;
  /** 测试注入。 */
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface BailianFiletransResult {
  text: string;
  /** 每个声道一条，含分句时间戳原文。 */
  transcripts: unknown[];
  taskId: string;
  raw: unknown;
}

function host(workspaceId: string | null | undefined): string {
  const ws = workspaceId?.trim();
  return ws ? `https://${ws}.cn-beijing.maas.aliyuncs.com` : 'https://dashscope.aliyuncs.com';
}

export function bailianFiletransSubmitUrl(workspaceId: string | null | undefined): string {
  return `${host(workspaceId)}/api/v1/services/audio/asr/transcription`;
}

export function bailianTaskUrl(workspaceId: string | null | undefined, taskId: string): string {
  return `${host(workspaceId)}/api/v1/tasks/${encodeURIComponent(taskId)}`;
}

/** 转写结果 JSON → 整段文字。多声道时按声道顺序拼接。 */
export function extractFiletransText(result: unknown): { text: string; transcripts: unknown[] } {
  const transcripts = Array.isArray((result as any)?.transcripts) ? (result as any).transcripts : [];
  const text = transcripts
    .map((t: any) => (typeof t?.text === 'string' ? t.text : ''))
    .filter(Boolean)
    .join('\n');
  return { text, transcripts };
}

export async function callBailianFiletrans(
  provider: { workspaceId: string | null },
  apiKey: string,
  options: BailianFiletransOptions,
  fetchImpl: typeof fetch = fetch,
): Promise<BailianFiletransResult> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = now();

  const submit = await fetchImpl(bailianFiletransSubmitUrl(provider.workspaceId), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // 缺这个头会被当成同步调用，直接报错。
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify({
      model: options.model,
      input: buildFiletransInput(options.model, options.fileUrl),
      parameters: {
        ...(options.channelIds?.length ? { channel_id: options.channelIds } : {}),
        ...(options.vocabulary ? { vocabulary: options.vocabulary } : {}),
        ...(options.vocabularyId ? { vocabulary_id: options.vocabularyId } : {}),
        ...(options.languageHints?.length ? { language_hints: options.languageHints } : {}),
      },
    }),
    signal: options.signal,
  });

  if (!submit.ok) {
    const text = (await submit.text()).slice(0, 300);
    throw new UpstreamError(submit.status, `百炼录音文件转写提交失败 (${submit.status}): ${text}`);
  }

  const submitted = (await submit.json()) as any;
  const taskId = submitted?.output?.task_id;
  if (typeof taskId !== 'string' || !taskId) {
    throw new UpstreamError(502, `百炼录音文件转写提交未返回 task_id：${JSON.stringify(submitted).slice(0, 200)}`);
  }

  for (;;) {
    if (options.signal?.aborted) throw new UpstreamError(499, '百炼录音文件转写中止：客户端已断开连接');
    if (now() - startedAt > timeoutMs) {
      throw new UpstreamError(504, `百炼录音文件转写超时：任务 ${taskId} 在 ${timeoutMs}ms 内未完成`);
    }

    await sleep(options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);

    const poll = await fetchImpl(bailianTaskUrl(provider.workspaceId, taskId), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: options.signal,
    });
    if (!poll.ok) {
      const text = (await poll.text()).slice(0, 300);
      throw new UpstreamError(poll.status, `百炼录音文件转写轮询失败 (${poll.status}): ${text}`);
    }

    const polled = (await poll.json()) as any;
    const status = polled?.output?.task_status;

    if (status === 'FAILED') {
      const reason = polled?.output?.message ?? polled?.output?.code ?? JSON.stringify(polled?.output ?? {}).slice(0, 200);
      throw new UpstreamError(400, `百炼录音文件转写失败：${reason}`);
    }
    if (status !== 'SUCCEEDED') continue;

    // 结果不在轮询响应里，得再下载一次。实测字段是 output.result.transcription_url，
    // 多文件提交时会变成 output.results[].transcription_url，两种都认。
    const url =
      polled?.output?.result?.transcription_url ??
      polled?.output?.results?.[0]?.transcription_url ??
      polled?.output?.results?.[0]?.transcription_url;
    if (typeof url !== 'string' || !url) {
      throw new UpstreamError(502, `百炼录音文件转写成功但未给出结果地址：${JSON.stringify(polled?.output ?? {}).slice(0, 200)}`);
    }

    const resultRes = await fetchImpl(url, { signal: options.signal });
    if (!resultRes.ok) {
      throw new UpstreamError(resultRes.status, `百炼录音文件转写结果下载失败 (${resultRes.status})`);
    }
    const result = await resultRes.json();
    const { text, transcripts } = extractFiletransText(result);
    return { text, transcripts, taskId, raw: result };
  }
}
