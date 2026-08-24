import type { ProviderRow } from '@/lib/services/provider';
import type { Protocol } from '@/lib/services/provider';
import type { UsageInfo } from '@/lib/gateway/logger';

type Json = Record<string, any>;

/** 适配器构造出的上游请求 */
export interface AdapterRequest {
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface AdapterContext {
  provider: ProviderRow;
  /** 解密后的服务商 api_key */
  apiKey: string;
  /** 上游真实模型名（路由解析结果） */
  modelId: string;
  stream: boolean;
  /** 客户端 stream_options.include_usage，流式末尾是否补 usage chunk */
  includeUsage: boolean;
}

export interface TranslatedStream {
  /** 转换后的 IR SSE 字节流（chat.completion.chunk，以 [DONE] 结尾） */
  stream: ReadableStream<Uint8Array>;
  /** 流结束后解析出的 usage（尽力而为，用于日志） */
  usage: Promise<UsageInfo | null>;
}

/**
 * 协议适配器接口（§3.2）：IR → 服务商原生协议的请求/响应/流转换。
 * 入口协议与服务商原生协议一致时不走适配器，直接原生透传（见 gateway/pipeline.ts）。
 */
export interface ProtocolAdapter {
  protocol: Protocol;
  /** IR 请求体 → 上游请求（含鉴权头与 model 名改写） */
  buildRequest(ir: Json, ctx: AdapterContext): AdapterRequest;
  /** 上游非流式响应 JSON → IR chat.completion */
  convertResponse(nativeJson: Json, ctx: AdapterContext): Json;
  /** 从上游原生响应提取内部日志用量；不得把内部字段泄漏到公开响应。 */
  extractUsage(nativeJson: Json, ctx: AdapterContext): UsageInfo | null;
  /** 上游 SSE 字节流 → IR SSE 字节流 */
  translateStream(upstreamBody: ReadableStream<Uint8Array>, ctx: AdapterContext): TranslatedStream;
}
