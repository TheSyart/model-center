import {
  anthropicResponseToIR,
  anthropicStreamToIR,
  anthropicUsageFromJson,
  irRequestToAnthropic,
} from '@/lib/protocols/anthropic';
import type { AdapterContext, AdapterRequest, ProtocolAdapter, TranslatedStream } from './types';

type Json = Record<string, any>;

export const ANTHROPIC_VERSION = '2023-06-01';

/** Anthropic Messages 上游适配器：IR → Anthropic，Anthropic 响应/流 → IR。 */
export const anthropicAdapter: ProtocolAdapter = {
  protocol: 'anthropic',
  buildRequest(ir: Json, ctx: AdapterContext): AdapterRequest {
    return {
      url: `${ctx.provider.baseUrl.replace(/\/+$/, '')}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ctx.apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: irRequestToAnthropic(ir, ctx.modelId, ctx.reasoning),
    };
  },
  convertResponse(nativeJson: Json, ctx: AdapterContext): Json {
    return anthropicResponseToIR(nativeJson, ctx.modelId);
  },
  extractUsage(nativeJson: Json) {
    return anthropicUsageFromJson(nativeJson);
  },
  translateStream(upstreamBody: ReadableStream<Uint8Array>, ctx: AdapterContext): TranslatedStream {
    return anthropicStreamToIR(upstreamBody, { model: ctx.modelId, includeUsage: ctx.includeUsage });
  },
};
