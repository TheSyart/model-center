import crypto from 'node:crypto';
import { WebSocket } from 'undici';
import { UpstreamError } from '../../upstream-error.ts';

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
 * 这里只做「一次性合成」：把文本发完、收齐音频、关连接，对外仍是一个普通的
 * HTTP 响应。网关暂不对外提供流式语音，所以没必要把 WebSocket 的分片暴露出去。
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

/** 只取我们用到的那部分 WebSocket 接口，便于测试替身实现。 */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: any) => void): void;
}

export function bailianTtsWebSocketUrl(workspaceId: string | null | undefined): string {
  const ws = workspaceId?.trim();
  const host = ws ? `${ws}.cn-beijing.maas.aliyuncs.com` : 'dashscope.aliyuncs.com';
  return `wss://${host}/api-ws/v1/inference`;
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
  // 所以必须点名唯一可用的那个音色，否则调用方无从下手。
  if (/\b411\b/.test(upstreamMessage) && lower.includes('qwen-audio')) {
    if (lower.includes('3.1')) {
      return '（411 表示音色不被该模型接受。qwen-audio-3.1-tts-flash 实测拒绝全部 20 个预置音色，包括不传——推断它只接受 voice-enrollment 复刻出来的音色，需先创建克隆音色再把其 ID 作为 voice 传入。）';
    }
    return `（411 表示音色不被该模型接受。${model} 实测只接受 longanlingxi，连不传 voice 都会被拒，当前传的是 ${voice ?? '（未指定）'}。）`;
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

export function synthesizeOverWebSocket(
  workspaceId: string | null | undefined,
  apiKey: string,
  options: BailianWsTtsOptions,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<BailianWsTtsResult> {
  const url = bailianTtsWebSocketUrl(workspaceId);
  const streaming = streamingModeFor(options.model);
  const taskId = crypto.randomUUID();

  return new Promise<BailianWsTtsResult>((resolve, reject) => {
    const chunks: Buffer[] = [];
    /**
     * 二进制帧转 Buffer 是异步的（Blob.arrayBuffer），而 task-finished 是同步事件。
     * 不把它们排进同一条链，最后一个分片就可能在 resolve 之后才落地，音频缺尾。
     */
    let pending: Promise<unknown> = Promise.resolve();
    let characters: number | undefined;
    let requestId: string | undefined;
    let settled = false;
    let socket: WebSocketLike;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
      try {
        socket?.close();
      } catch {
        // 连接可能已经断了，关不上无所谓。
      }
      fn();
    };

    const fail = (status: number, message: string) => finish(() => reject(new UpstreamError(status, message)));
    // 等所有在途分片都入列再收口。
    const succeed = () => {
      void pending.then(() => finish(() => resolve({ audio: Buffer.concat(chunks), characters, requestId })));
    };

    const timer = setTimeout(
      () => fail(504, `百炼 TTS 失败：WebSocket 无响应，已超过 ${timeoutMs}ms 上限`),
      timeoutMs,
    );
    const onAbort = () => fail(499, '百炼 TTS 中止：客户端已断开连接');
    options.signal?.addEventListener('abort', onAbort);
    if (options.signal?.aborted) {
      onAbort();
      return;
    }

    const header = (action: string) => ({ action, task_id: taskId, streaming });
    const parameters: Record<string, unknown> = {
      text_type: 'PlainText',
      format: options.format ?? 'mp3',
      sample_rate: options.sampleRate ?? 22050,
      ...(options.voice ? { voice: options.voice } : {}),
      ...(options.volume !== undefined ? { volume: options.volume } : {}),
      ...(options.rate !== undefined ? { rate: options.rate } : {}),
      ...(options.pitch !== undefined ? { pitch: options.pitch } : {}),
    };

    try {
      socket = options.connect
        ? options.connect(url, apiKey)
        : (new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } } as never) as WebSocketLike);
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
          if (buf) chunks.push(buf);
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
        succeed();
      } else if (kind === 'task-failed') {
        const code = message?.header?.error_code ?? 'unknown';
        const text = message?.header?.error_message ?? '（上游未给出原因）';
        fail(400, `百炼 TTS 失败 (${code}): ${text}${ttsFailureHint(options.model, options.voice, text)}`);
      }
    });

    socket.addEventListener('error', (event: { message?: string }) => {
      fail(502, `百炼 TTS 失败：WebSocket 错误 ${event?.message ?? ''}`.trim());
    });

    socket.addEventListener('close', () => {
      // 正常结束时 task-finished 已经 resolve 过了；走到这里说明连接先断了。
      if (chunks.length > 0) succeed();
      else fail(502, '百炼 TTS 失败：WebSocket 在返回音频前就关闭了');
    });
  });
}
