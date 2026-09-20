import { createPushStream } from '../../protocols/push-stream.ts';
import { deferred } from '../../protocols/sse.ts';
import { UpstreamError } from '../../upstream-error.ts';
import { bailianWsHost, connectBailianWs, type WebSocketLike } from './ws-transport.ts';

/**
 * 百炼 Realtime 语音合成（协议 B）。
 *
 * 只有带 `-realtime` 后缀的模型走这里：`qwen3-tts-flash-realtime`、
 * `qwen3-tts-instruct-flash-realtime`、`qwen3-tts-vc/vd-realtime-*`。
 * 协议是 OpenAI Realtime 风格，与 run-task 那套没有任何交集，见 ws-transport.ts。
 *
 * 2026-09-20 用真实密钥实测，公共域名与 workspace 专有域名都可用：
 * `qwen3-tts-flash-realtime` 出音 122880 字节，首包 382ms。
 *
 * **两个会骗人的地方，实现必须避开：**
 *
 * 1. 建连时**根本不校验模型名**。拿「不存在的模型xyz」去连，照样回
 *    `session.created`。所以不能用它判断模型可用——唯一可靠的信号是有没有
 *    音频回来。这也是为什么这里跟协议 A 一样，要等到第一个分片才算开流成功。
 * 2. `response.audio.done` **不是终止事件**。一次会话可以有多轮
 *    response.created/audio.done，只有 `session.finished` 才结束。
 *    认错了会在第一个句子边界处截断。
 *
 * 实测事件序列：
 * session.created → session.updated → input_text_buffer.committed →
 * response.created → response.output_item.added → response.content_part.added →
 * response.audio.delta（base64 在 `delta` 字段）→ response.audio.done →
 * response.content_part.done → response.output_item.done → response.done →
 * session.finished
 */

const DEFAULT_TIMEOUT_MS = 120_000;

export type BailianRealtimeMode = 'server_commit' | 'commit';
export type BailianRealtimeFormat = 'pcm' | 'wav' | 'mp3' | 'opus';

export interface BailianRealtimeSession {
  voice?: string;
  /** 默认 server_commit：服务端自己决定何时开合成。 */
  mode?: BailianRealtimeMode;
  /** Auto / Chinese / English / … */
  languageType?: string;
  responseFormat?: BailianRealtimeFormat;
  sampleRate?: number;
  /** 0.5–2.0 */
  speechRate?: number;
  /** 0–100 */
  volume?: number;
  /** 0.5–2.0 */
  pitchRate?: number;
  /** 6–510 kbps，仅 opus。 */
  bitRate?: number;
  /** 仅 instruct 系模型生效。 */
  instructions?: string;
  optimizeInstructions?: boolean;
}

export interface BailianRealtimeTtsOptions extends BailianRealtimeSession {
  model: string;
  text: string;
  signal?: AbortSignal;
  /** 测试注入。 */
  connect?: (url: string, apiKey: string) => WebSocketLike;
  maxBufferedBytes?: number;
  idleTimeoutMs?: number;
}

export type BailianRealtimeReason = 'finished' | 'failed' | 'cancelled' | 'truncated';

export interface BailianRealtimeCompletion {
  reason: BailianRealtimeReason;
  requestId?: string;
  /** response.done 的 usage 原样带出，不做归一化——口径不是 token。 */
  usage?: Record<string, unknown> | null;
  characters?: number;
  error?: Error;
}

export interface BailianRealtimeStream {
  chunks: AsyncGenerator<Uint8Array, void, undefined>;
  /** 与协议 A 一致：正常结束、报错、取消都 resolve，永不 reject。 */
  completion: Promise<BailianRealtimeCompletion>;
  firstChunkMs: number;
}

/** model 在 **URL query** 上，不在消息体里。放错位置的表现是完全不出音。 */
export function bailianRealtimeTtsUrl(workspaceId: string | null | undefined, model: string): string {
  return `wss://${bailianWsHost(workspaceId)}/api-ws/v1/realtime?model=${encodeURIComponent(model)}`;
}

/** 上游的 error.code → HTTP 状态码。认不出来一律 502，别把参数错误吞成网关故障。 */
export function realtimeErrorStatus(code: string | undefined): number {
  if (!code) return 502;
  if (/invalid|unsupported|not_found|missing/i.test(code)) return 400;
  if (/auth|permission|forbidden/i.test(code)) return 403;
  if (/rate|quota|throttl/i.test(code)) return 429;
  return 502;
}

export function buildRealtimeSession(options: BailianRealtimeSession): Record<string, unknown> {
  return {
    ...(options.voice ? { voice: options.voice } : {}),
    mode: options.mode ?? 'server_commit',
    ...(options.languageType ? { language_type: options.languageType } : {}),
    response_format: options.responseFormat ?? 'pcm',
    sample_rate: options.sampleRate ?? 24000,
    ...(options.speechRate !== undefined ? { speech_rate: options.speechRate } : {}),
    ...(options.volume !== undefined ? { volume: options.volume } : {}),
    ...(options.pitchRate !== undefined ? { pitch_rate: options.pitchRate } : {}),
    ...(options.bitRate !== undefined ? { bit_rate: options.bitRate } : {}),
    ...(options.instructions ? { instructions: options.instructions } : {}),
    ...(options.optimizeInstructions !== undefined ? { optimize_instructions: options.optimizeInstructions } : {}),
  };
}

export function openBailianRealtimeTtsStream(
  workspaceId: string | null | undefined,
  apiKey: string,
  options: BailianRealtimeTtsOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<BailianRealtimeStream> {
  const url = bailianRealtimeTtsUrl(workspaceId, options.model);
  const idleTimeoutMs = options.idleTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = Date.now();

  return new Promise<BailianRealtimeStream>((resolveOpen, rejectOpen) => {
    const push = createPushStream({ maxBufferedBytes: options.maxBufferedBytes });
    const completion = deferred<BailianRealtimeCompletion>();
    let usage: Record<string, unknown> | null = null;
    let characters: number | undefined;
    let requestId: string | undefined;
    let opened = false;
    let settled = false;
    let chunkCount = 0;
    let socket: WebSocketLike;
    let firstTimer: ReturnType<typeof setTimeout> | undefined;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    const clearTimers = () => {
      if (firstTimer) clearTimeout(firstTimer);
      if (idleTimer) clearTimeout(idleTimer);
      firstTimer = undefined;
      idleTimer = undefined;
    };

    const settle = (reason: BailianRealtimeReason, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimers();
      options.signal?.removeEventListener('abort', onAbort);
      try {
        socket?.close();
      } catch {
        // 关不上无所谓。
      }
      completion.resolve({ reason, requestId, usage, characters, error });
    };

    const fail = (status: number, message: string, reason: BailianRealtimeReason = 'failed') => {
      const error = new UpstreamError(status, message);
      push.fail(error);
      settle(reason, error);
      if (!opened) rejectOpen(error);
    };

    const armIdle = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => fail(504, `百炼实时 TTS 失败：已 ${idleTimeoutMs}ms 没有新的音频分片`),
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
      () => fail(504, `百炼实时 TTS 失败：${timeoutMs}ms 内没有返回任何音频`),
      timeoutMs,
    );
    const onAbort = () => fail(499, '百炼实时 TTS 中止：客户端已断开连接', 'cancelled');
    options.signal?.addEventListener('abort', onAbort);
    if (options.signal?.aborted) {
      onAbort();
      return;
    }

    push.onCancel(() => settle('cancelled'));

    try {
      socket = options.connect ? options.connect(url, apiKey) : connectBailianWs(url, apiKey);
    } catch (e) {
      fail(502, `百炼实时 TTS 失败：无法建立 WebSocket 连接（${e instanceof Error ? e.message : String(e)}）`);
      return;
    }

    const send = (payload: Record<string, unknown>) => socket.send(JSON.stringify(payload));

    socket.addEventListener('message', (event: { data: unknown }) => {
      // 官方契约是 base64 走 JSON 文本帧，但实测报告里也见过裸二进制帧，
      // 两种都收——多认一种不会错，少认一种就是静默不出音。
      if (typeof event.data !== 'string') {
        const buf = toBytes(event.data);
        if (!buf || settled) return;
        chunkCount += 1;
        push.push(buf);
        onFirstChunk();
        armIdle();
        return;
      }

      let message: any;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const type = message?.type;

      if (type === 'session.created') {
        requestId ??= message?.session?.id;
        send({ type: 'session.update', session: buildRealtimeSession(options) });
        send({ type: 'input_text_buffer.append', text: options.text });
        // commit 不能省：server_commit 模式下它仍然是把尾巴冲出来的那一下，
        // 与协议 A 的 finish-task 是同一个坑。
        send({ type: 'input_text_buffer.commit' });
        send({ type: 'session.finish' });
      } else if (type === 'response.audio.delta') {
        const b64 = message?.delta;
        if (typeof b64 !== 'string' || b64.length === 0 || settled) return;
        chunkCount += 1;
        push.push(new Uint8Array(Buffer.from(b64, 'base64')));
        onFirstChunk();
        armIdle();
      } else if (type === 'response.done') {
        const u = message?.response?.usage;
        if (u && typeof u === 'object') {
          usage = u as Record<string, unknown>;
          if (typeof u.characters === 'number') characters = u.characters;
        }
      } else if (type === 'session.finished') {
        // 只有它才是终点。response.audio.done 是每一轮的，不是会话的。
        if (chunkCount === 0) {
          // 报告成功却没给音频：一个 200 的空音频比一个错误更难排查。
          fail(502, '百炼实时 TTS 失败：会话正常结束，却没有返回任何音频。');
          return;
        }
        push.close();
        settle('finished');
      } else if (type === 'error') {
        const code = message?.error?.code;
        const text = message?.error?.message ?? '（上游未给出原因）';
        fail(realtimeErrorStatus(code), `百炼实时 TTS 失败 (${code ?? 'unknown'}): ${text}`);
      }
    });

    socket.addEventListener('error', (event: { message?: string }) => {
      fail(502, `百炼实时 TTS 失败：WebSocket 错误 ${event?.message ?? ''}`.trim());
    });

    socket.addEventListener('close', () => {
      if (settled) return;
      if (chunkCount > 0) {
        push.close();
        settle('truncated');
      } else {
        // 模型名写错就长这样：session.created 照回，然后一声不响地关掉。
        fail(
          502,
          `百炼实时 TTS 失败：连接在返回任何音频前就关闭了。` +
            `该端点不校验模型名，"${options.model}" 可能并不支持实时合成。`,
        );
      }
    });
  });
}

function toBytes(data: unknown): Uint8Array | null {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return null;
}
