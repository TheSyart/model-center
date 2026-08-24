import { geminiResponseToIR, geminiStreamToIR, geminiUrl, geminiUsageFromJson, irRequestToGemini } from '@/lib/protocols/gemini';
import type { AdapterContext, AdapterRequest, ProtocolAdapter, TranslatedStream } from './types';

type Json = Record<string, any>;

/** Google Gemini 上游适配器：IR → Gemini generateContent，Gemini 响应/流 → IR。 */
export const geminiAdapter: ProtocolAdapter = {
  protocol: 'gemini',
  buildRequest(ir: Json, ctx: AdapterContext): AdapterRequest {
    return {
      url: geminiUrl(ctx.provider.baseUrl, ctx.modelId, ctx.stream),
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': ctx.apiKey,
      },
      body: irRequestToGemini(ir),
    };
  },
  convertResponse(nativeJson: Json, ctx: AdapterContext): Json {
    return geminiResponseToIR(nativeJson, ctx.modelId);
  },
  extractUsage(nativeJson: Json) {
    return geminiUsageFromJson(nativeJson);
  },
  translateStream(upstreamBody: ReadableStream<Uint8Array>, ctx: AdapterContext): TranslatedStream {
    return geminiStreamToIR(upstreamBody, { model: ctx.modelId, includeUsage: ctx.includeUsage });
  },
};
