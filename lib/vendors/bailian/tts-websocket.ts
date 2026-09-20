import crypto from 'node:crypto';
import { createPushStream } from '../../protocols/push-stream.ts';
import { deferred } from '../../protocols/sse.ts';
import { UpstreamError } from '../../upstream-error.ts';
import { bailianWsHost, connectBailianWs, type WebSocketLike } from './ws-transport.ts';

export type { WebSocketLike };

/**
 * 百炼 WebSocket 语音合成。
 *
 * Sambert、CosyVoice、Qwen-Audio-TTS 这三族**只能走 WebSocket**：HTTP 的
 * SpeechSynthesizer 端点对它们回 `current user api does not support http call`
 * 或 `Engine return error code: 418`。而 Qwen-TTS 正相反，WebSocket 上查无此模型
 * （`Model not found`），只能走 HTTP。两边没有交集，见 resolveBailianAudioRoute。
 *
 * 契约 2026-09-20 用真实密钥实测；协议细节见 docs/vendor-apis/bailian.md。
 *
 * 对外有两条路：openBailianTtsStream 边收边交（分片本来就是逐帧到的），
 * synthesizeOverWebSocket 读到底再拼成整包。后者就是前者的缓冲包装。
 */

const DEFAULT_TIMEOUT_MS = 120_000;

export type BailianTtsStreamingMode = 'duplex' | 'out';

export interface BailianWsTtsOptions {
  model: string;
  text: string;
  /** Sambert 不接受 voice——模型名本身就是音色。 */
  voice?: string;
  format?: 'wav' | 'mp3' | 'pcm';
  sampleRate?: number;
  volume?: number;
  rate?: number;
  pitch?: number;
  /** 仅 instruct 系模型生效。注意上游这里是**单数** instruction。 */
  instruction?: string;
  signal?: AbortSignal;
  /** 测试注入用。 */
  connect?: (url: string, apiKey: string) => WebSocketLike;
}

export interface BailianWsTtsResult {
  audio: Buffer;
  /** 上游报告的字符数，没有就为空。 */
  characters?: number;
  requestId?: string;
}

export function bailianTtsWebSocketUrl(workspaceId: string | null | undefined): string {
  return `wss://${bailianWsHost(workspaceId)}/api-ws/v1/inference`;
}

/**
 * Sambert 用 `streaming: "out"`：不支持流式输入，全部文本必须随 run-task 一次发出，
 * 没有 continue-task。其余两族用 `duplex`，文本走 continue-task 再 finish-task。
 * 用错模式的表现是 `Request text is invalid!`。
 */
export function streamingModeFor(modelId: string): BailianTtsStreamingMode {
  return modelId.toLowerCase().startsWith('sambert') ? 'out' : 'duplex';
}

/**
 * 把上游那些说不清原因的报错翻译成可操作的提示。
 *
 * 依据都来自实测或官方模型简介，不猜：
 *  - 418 实测是「音色不属于这个模型」（cosyvoice-v2 只认 `*_v2`，v3 起只认无后缀，互换必 418）；
 *  - 411 是 qwen-audio-*-tts 表达同一件事的方式，2026-09-20 拿 20 个候选音色逐个实打；
 *  - vc / vd 两族的官方简介明写要用专门服务复刻或设计出来的声音。
 */
export function ttsFailureHint(model: string, voice: string | undefined, upstreamMessage: string): string {
  const lower = model.toLowerCase();

  // 官方简介原文：「可对 qwen-voice-enrollment 服务复刻的声音进行高保真实时语音合成」
  if (/-vc-|-vc$/.test(lower)) {
    return '（该模型只合成 qwen-voice-enrollment 服务复刻出来的声音，必须把复刻音色的 ID 作为 voice 传入，预置音色不适用。）';
  }
  // 官方简介原文：「可对 qwen3-voice-design 服务设计的声音进行高保真实时语音合成」
  if (/-vd-|-vd$/.test(lower)) {
    return '（该模型只合成 qwen3-voice-design 服务设计出来的声音，必须把设计音色的 ID 作为 voice 传入，预置音色不适用。）';
  }

  // qwen-audio-*-tts 用 411 表示同一件事，但连「不传 voice」都会被 411 拒，
  // 所以必须给出实测可用的音色名，否则调用方无从下手。
  if (/\b411\b/.test(upstreamMessage) && lower.includes('qwen-audio')) {
    if (lower.includes('3.1')) {
      return '（411 表示音色不被该模型接受。qwen-audio-3.1-tts-flash 实测拒绝所有预置音色，包括不传——它只接受 voice-enrollment 复刻出来的音色，用克隆音色已验证可出音，请先创建克隆音色再把其 ID 作为 voice 传入。）';
    }
    const usable = lower.includes('plus')
      ? 'longanlingxi、longanhuan_v3.6'
      : 'longanlingxi、longanhuan_v3.6、longpaopao_v3.6、longjielidou_v3.6、loongmary';
    return (
      `（411 表示音色不被该模型接受——它是 CosyVoice 系，不认 Cherry 这类 Qwen-TTS 系的英文名。` +
      `${model} 实测可用：${usable}；当前传的是 ${voice ?? '（未指定，该模型不传也会被拒）'}。）`
    );
  }

  if (!/\b418\b/.test(upstreamMessage)) return '';
  if (/cosyvoice-v3\.5/.test(lower)) {
    return '（418 表示音色与模型不匹配。cosyvoice-v3.5 系列主打声音克隆与声音设计，实测所有预置音色都被拒，需先创建克隆音色再把其 ID 作为 voice 传入。）';
  }
  if (lower.startsWith('cosyvoice')) {
    const expected = /cosyvoice-v[12]\b/.test(lower) ? '带 _v2 后缀的一套' : '不带版本后缀的一套（如 longanhuan）';
    return `（418 表示音色与模型不匹配：${model} 需要${expected}，当前传的是 ${voice ?? '（未指定）'}。）`;
  }
  return '';
}

async function toBuffer(data: unknown): Promise<Buffer | null> {
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (data && typeof (data as Blob).arrayBuffer === 'function') {
    return Buffer.from(await (data as Blob).arrayBuffer());
  }
  return null;
}

export type BailianTtsFinishReason = 'finished' | 'failed' | 'cancelled' | 'truncated';

export interface BailianWsTtsCompletion {
  reason: BailianTtsFinishReason;
  /** 只有 task-finished 才知道；那时音频字节早已发走，所以必须走这条旁路。 */
  characters?: number;
  requestId?: string;
  /** reason==='failed' 时的原始错误，写日志用；不会再 reject 一次。 */
  error?: Error;
}

export interface BailianWsTtsStream {
  chunks: AsyncGenerator<Uint8Array, void, undefined>;
  /**
   * 正常结束、上游报错、客户端取消都 **resolve**，永不 reject。
   * 日志的 after() 等它——悬挂就是永久泄漏（同 lib/protocols/responses.ts 的不变量）。
   */
  completion: Promise<BailianWsTtsCompletion>;
  /** 首个音频分片的毫秒耗时。 */
  firstChunkMs: number;
}

export interface BailianWsTtsStreamOptions extends BailianWsTtsOptions {
  /** 排队上限，默认 16 MiB。 */
  maxBufferedBytes?: number;
  /** 首片之后，两片之间的最大间隔。默认 120s。 */
  idleTimeoutMs?: number;
}

/**
 * 开一路流式合成。
 *
 * 返回的 Promise **等到第一个音频分片（或上游报错）才 resolve**，因为在那之前
 * 还来得及把错误变成一个正经的 HTTP 4xx——音色不对这类问题全都发生在任何音频
 * 之前。一旦开始出音频，HTTP 状态码就定死是 200 了，错误只能体现为流的异常结束。
 *
 * 超时语义也因此改变：`timeoutMs` 只约束**首包**，帧与帧之间由 `idleTimeoutMs`
 * 约束，**没有总时长上限**。合成一段 5000 字的长文本本来就可能超过两分钟，
 * 用一个墙钟把它砍掉是错的；能区分「慢」和「挂」的只有帧间隔。
 */
export function openBailianTtsStream(
  workspaceId: string | null | undefined,
  apiKey: string,
  options: BailianWsTtsStreamOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<BailianWsTtsStream> {
  const url = bailianTtsWebSocketUrl(workspaceId);
  const streaming = streamingModeFor(options.model);
  const taskId = crypto.randomUUID();
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  return new Promise<BailianWsTtsStream>((resolveOpen, rejectOpen) => {
    const push = createPushStream({ maxBufferedBytes: options.maxBufferedBytes });
    /**
     * 二进制帧转 Buffer 是异步的（Blob.arrayBuffer），而 task-finished 是同步事件。
     * 不把它们排进同一条链，最后一个分片就可能在收口之后才落地，音频缺尾。
     */
    let pending: Promise<unknown> = Promise.resolve();
    let characters: number | undefined;
    let requestId: string | undefined;
    let opened = false;
    let settled = false;
    let chunkCount = 0;
    let socket: WebSocketLike;

    const completion = deferred<BailianWsTtsCompletion>();
    let firstTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      if (firstTimer) clearTimeout(firstTimer);
      if (idleTimer) clearTimeout(idleTimer);
      firstTimer = undefined;
      idleTimer = undefined;
    };

    const settle = (reason: BailianTtsFinishReason, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      options.signal?.removeEventListener('abort', onAbort);
      try {
        socket?.close();
      } catch {
        // 连接可能已经断了，关不上无所谓。
      }
      completion.resolve({ reason, characters, requestId, error });
    };

    /**
     * 在出第一个音频分片之前失败：还能变成 HTTP 状态码。之后就只能中断流。
     *
     * `reason` 区分的是「谁的责任」：上游拒绝是 failed，客户端走开是 cancelled。
     * 两者在日志里的含义完全不同——后者不是故障。
     */
    const fail = (status: number, message: string, reason: BailianTtsFinishReason = 'failed') => {
      const error = new UpstreamError(status, message);
      push.fail(error);
      settle(reason, error);
      if (!opened) rejectOpen(error);
    };

    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => fail(504, `百炼 TTS 失败：已 ${idleTimeoutMs}ms 没有新的音频分片`),
        idleTimeoutMs,
      );
    };

    const onFirstChunk = () => {
      if (opened) return;
      opened = true;
      if (firstTimer) clearTimeout(firstTimer);
      firstTimer = undefined;
      armIdle();
      resolveOpen({ chunks: push.chunks, completion: completion.promise, firstChunkMs: Date.now() - startedAt });
    };

    firstTimer = setTimeout(
      () => fail(504, `百炼 TTS 失败：WebSocket 在 ${timeoutMs}ms 内没有返回任何音频`),
      timeoutMs,
    );
    const onAbort = () => fail(499, '百炼 TTS 中止：客户端已断开连接', 'cancelled');
    options.signal?.addEventListener('abort', onAbort);
    if (options.signal?.aborted) {
      onAbort();
      return;
    }

    // 下游不读了（客户端断开、或响应被取消）→ 关掉上游，别继续合成继续计费。
    push.onCancel(() => settle('cancelled'));

    const header = (action: string) => ({ action, task_id: taskId, streaming });
    const parameters: Record<string, unknown> = {
      text_type: 'PlainText',
      format: options.format ?? 'mp3',
      sample_rate: options.sampleRate ?? 22050,
      ...(options.voice ? { voice: options.voice } : {}),
      ...(options.volume !== undefined ? { volume: options.volume } : {}),
      ...(options.rate !== undefined ? { rate: options.rate } : {}),
      ...(options.pitch !== undefined ? { pitch: options.pitch } : {}),
      ...(options.instruction ? { instruction: options.instruction } : {}),
    };

    try {
      socket = options.connect
        ? options.connect(url, apiKey)
        : connectBailianWs(url, apiKey);
    } catch (e) {
      fail(502, `百炼 TTS 失败：无法建立 WebSocket 连接（${e instanceof Error ? e.message : String(e)}）`);
      return;
    }

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          header: header('run-task'),
          payload: {
            task_group: 'audio',
            task: 'tts',
            function: 'SpeechSynthesizer',
            model: options.model,
            parameters,
            // streaming=out 的模型文本必须在这里就给全。
            input: streaming === 'out' ? { text: options.text } : {},
          },
        }),
      );
    });

    socket.addEventListener('message', (event: { data: unknown }) => {
      if (typeof event.data !== 'string') {
        pending = pending.then(async () => {
          const buf = await toBuffer(event.data);
          if (!buf || settled) return;
          chunkCount += 1;
          push.push(buf);
          onFirstChunk();
          armIdle();
        });
        return;
      }

      let message: any;
      try {
        message = JSON.parse(event.data);
      } catch {
        return; // 不是控制帧就忽略，音频只从二进制通道来。
      }

      requestId ??= message?.header?.task_id;
      const kind = message?.header?.event;

      if (kind === 'task-started' && streaming === 'duplex') {
        socket.send(JSON.stringify({ header: header('continue-task'), payload: { input: { text: options.text } } }));
        // finish-task 不能省：服务端靠它把缓存里的尾巴也合成出来。
        socket.send(JSON.stringify({ header: header('finish-task'), payload: { input: {} } }));
      } else if (kind === 'result-generated') {
        const n = message?.payload?.usage?.characters;
        if (typeof n === 'number') characters = n;
      } else if (kind === 'task-finished') {
        const n = message?.payload?.usage?.characters;
        if (typeof n === 'number') characters = n;
        // 等在途分片入列再收口，否则尾音会丢。
        void pending.then(() => {
          if (chunkCount === 0) {
            /**
             * 上游报告成功却一个字节都没给。实测最常见的原因是**音色还没部署完**
             * （query_voice 的 status 还是 DEPLOYING），这时合成会安静地返回空。
             * 不把它变成错误，客户端就会拿到一个 200 的空音频，什么也听不出来。
             */
            fail(
              502,
              '百炼 TTS 失败：上游报告合成完成，却没有返回任何音频。' +
                '若用的是自定义音色，多半是它还没部署完（查询音色状态应为 OK 而不是 DEPLOYING）。',
            );
            return;
          }
          push.close();
          settle('finished');
        });
      } else if (kind === 'task-failed') {
        const code = message?.header?.error_code ?? 'unknown';
        const text = message?.header?.error_message ?? '（上游未给出原因）';
        void pending.then(() =>
          fail(400, `百炼 TTS 失败 (${code}): ${text}${ttsFailureHint(options.model, options.voice, text)}`),
        );
      }
    });

    socket.addEventListener('error', (event: { message?: string }) => {
      fail(502, `百炼 TTS 失败：WebSocket 错误 ${event?.message ?? ''}`.trim());
    });

    socket.addEventListener('close', () => {
      if (settled) return;
      void pending.then(() => {
        if (settled) return;
        if (chunkCount > 0) {
          // 收到过音频但没等到 task-finished：音频多半是截断的。
          // 此前这条路径被当作成功且无声无息，现在它在日志里有名字。
          push.close();
          settle('truncated');
        } else {
          fail(502, '百炼 TTS 失败：WebSocket 在返回音频前就关闭了');
        }
      });
    });
  });
}

/**
 * 一次性合成：把流读到底再拼成整包。
 *
 * 非流式的四条路仍然走这里，签名与行为都不变。
 */
export async function synthesizeOverWebSocket(
  workspaceId: string | null | undefined,
  apiKey: string,
  options: BailianWsTtsOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<BailianWsTtsResult> {
  const stream = await openBailianTtsStream(workspaceId, apiKey, options, timeoutMs);
  const parts: Buffer[] = [];
  for await (const chunk of stream.chunks) parts.push(Buffer.from(chunk));
  const done = await stream.completion;
  return { audio: Buffer.concat(parts), characters: done.characters, requestId: done.requestId };
}
