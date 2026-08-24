import { irRequestToResponses, responsesResponseToIR, responsesStreamToIR, responsesUsageFromJson } from '@/lib/protocols/responses';
import type { AdapterContext, AdapterRequest, ProtocolAdapter, TranslatedStream } from './types';

type Json = Record<string, any>;

/** OpenAI Responses API 上游适配器（Codex 系列）：IR → Responses，Responses 响应/流 → IR。 */
export const responsesAdapter: ProtocolAdapter = {
  protocol: 'openai-responses',
  buildRequest(ir: Json, ctx: AdapterContext): AdapterRequest {
    return {
      url: `${ctx.provider.baseUrl.replace(/\/+$/, '')}/responses`,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ctx.apiKey}`,
      },
      body: irRequestToResponses(ir, ctx.modelId),
    };
  },
  convertResponse(nativeJson: Json, ctx: AdapterContext): Json {
    return responsesResponseToIR(nativeJson, ctx.modelId);
  },
  extractUsage(nativeJson: Json) {
    return responsesUsageFromJson(nativeJson);
  },
  translateStream(upstreamBody: ReadableStream<Uint8Array>, ctx: AdapterContext): TranslatedStream {
    return responsesStreamToIR(upstreamBody, { model: ctx.modelId, includeUsage: ctx.includeUsage });
  },
};
