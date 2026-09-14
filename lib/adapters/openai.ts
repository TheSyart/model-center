import { observeOpenAIUsageFromSSE } from '@/lib/protocols/anthropic';
import { normalizeOpenAIUsage } from '@/lib/services/usage-metrics';
import { applyChatReasoning } from '@/lib/protocols/reasoning-emit';
import type { AdapterContext, AdapterRequest, ProtocolAdapter, TranslatedStream } from './types';

type Json = Record<string, any>;

/**
 * OpenAI Chat Completions 适配器。
 * 原生透传场景（入口 openai ↔ provider openai）由 pipeline 直接处理，不经过这里；
 * 本适配器服务于非 OpenAI 入口（如 /v1/messages）→ openai 服务商的转换路径。
 */
export const openaiAdapter: ProtocolAdapter = {
  protocol: 'openai',
  buildRequest(ir: Json, ctx: AdapterContext): AdapterRequest {
    const body: Json = { ...ir, model: ctx.modelId };
    if (ctx.reasoning) applyChatReasoning(body, ctx.reasoning);
    return {
      url: `${ctx.provider.baseUrl.replace(/\/+$/, '')}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.apiKey}`,
      },
      body,
    };
  },
  convertResponse(nativeJson: Json): Json {
    return nativeJson; // 已是 IR
  },
  extractUsage(nativeJson: Json) {
    return normalizeOpenAIUsage(nativeJson?.usage);
  },
  translateStream(upstreamBody: ReadableStream<Uint8Array>): TranslatedStream {
    // 恒等透传：随客户端 pull 增量观察 usage，保持原有背压。
    return observeOpenAIUsageFromSSE(upstreamBody);
  },
};
