import { WebSocket } from 'undici';

/**
 * 两套 WebSocket 协议唯一真正共用的东西：建连本身。
 *
 * 百炼的语音合成有两套**互不相通**的协议，模型名与端点严格绑定：
 *
 * | | 协议 A | 协议 B |
 * |---|---|---|
 * | 端点 | `/api-ws/v1/inference` | `/api-ws/v1/realtime?model=…` |
 * | 模型 | 不带 `-realtime` 后缀 | 必须带 `-realtime` 后缀 |
 * | model 传在哪 | 消息体 `payload.model` | **URL query** |
 * | 消息风格 | 百炼自有 run-task/continue-task | OpenAI Realtime 风格 |
 * | 音频帧 | 二进制帧 | JSON 文本帧里的 base64 |
 *
 * 交叉实测（2026-09-20）：`qwen3-tts-flash-realtime` 在协议 A 上是
 * `Model not found`；`qwen-audio-3.0-tts-flash` 在协议 B 上完全不出音。
 *
 * 除了建连，两边没有可共用的东西——消息处理器各写各的更短也更好读。
 * 等出现第三套协议再谈抽象。
 */

/** 只取我们用到的那部分 WebSocket 接口，便于测试替身实现。 */
export interface WebSocketLike {
  send(data: string): void;
  close(): void;
  addEventListener(type: 'open' | 'message' | 'error' | 'close', listener: (event: any) => void): void;
}

export function bailianWsHost(workspaceId: string | null | undefined): string {
  const ws = workspaceId?.trim();
  return ws ? `${ws}.cn-beijing.maas.aliyuncs.com` : 'dashscope.aliyuncs.com';
}

export function connectBailianWs(url: string, apiKey: string): WebSocketLike {
  return new WebSocket(url, { headers: { Authorization: `Bearer ${apiKey}` } } as never) as WebSocketLike;
}
