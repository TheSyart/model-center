/**
 * Gemini generateContent ↔ IR（OpenAI Chat Completions）转换（§3.2）。
 * 端点：{base_url}/v1beta/models/{model}:generateContent / :streamGenerateContent?alt=sse
 * 鉴权：x-goog-api-key 头。
 */
import { encodeSSE, generatorToStream, parseSSE, deferred } from './sse';
import { applyGeminiReasoning } from './reasoning-emit';
import type { ReasoningIntent } from '@/lib/gateway/reasoning';
import type { UsageInfo } from '@/lib/gateway/logger';
import { normalizeGeminiUsage, toPublicUsage } from '@/lib/services/usage-metrics';

type Json = Record<string, any>;

function textOf(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((p) => p && p.type === 'text')
      .map((p) => p.text ?? '')
      .join('');
  }
  return '';
}

function parseJsonSafe(text: string): Json {
  try {
    const v = JSON.parse(text);
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function thoughtSignature(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value.length > 1024 * 1024) return null;
  return value;
}

function toolCallThoughtSignature(message: Json, toolCall: Json): string | null {
  const direct =
    thoughtSignature(toolCall.extra_content?.google?.thought_signature) ??
    thoughtSignature(toolCall.function?.extra_content?.google?.thought_signature) ??
    thoughtSignature(toolCall.thoughtSignature) ??
    thoughtSignature(toolCall.thought_signature);
  if (direct) return direct;
  const detail = Array.isArray(message.reasoning_details)
    ? message.reasoning_details.find(
        (item: Json) => item?.type === 'reasoning.encrypted' && item.id === toolCall.id && thoughtSignature(item.data)
      )
    : undefined;
  return thoughtSignature(detail?.data);
}

function openAIToolCall(part: Json, index: number): Json {
  const upstreamId = part.functionCall?.id;
  const id =
    typeof upstreamId === 'string' && upstreamId && upstreamId.length <= 1024
      ? upstreamId
      : `call_${Math.random().toString(36).slice(2, 10)}_${index}`;
  const signature = thoughtSignature(part.thoughtSignature ?? part.thought_signature);
  return {
    id,
    type: 'function',
    index,
    function: {
      name: part.functionCall.name,
      arguments: JSON.stringify(part.functionCall.args ?? {}),
    },
    ...(signature ? { extra_content: { google: { thought_signature: signature } } } : {}),
  };
}

function encryptedReasoningDetail(toolCall: Json): Json | null {
  const signature = thoughtSignature(toolCall.extra_content?.google?.thought_signature);
  return signature ? { type: 'reasoning.encrypted', id: toolCall.id, data: signature } : null;
}

/** 从 URL 路径猜测图片 MIME（Gemini fileData 必填）。 */
function guessMime(url: string): string {
  const m = /\.(png|jpe?g|gif|webp|heic|bmp)(?:[?#]|$)/i.exec(url);
  if (!m) return 'image/jpeg';
  const ext = m[1].toLowerCase();
  return ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
}

function irImageToGemini(part: Json): Json | null {
  const url: string = part?.image_url?.url ?? '';
  if (!url) return null;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (m) return { inlineData: { mimeType: m[1], data: m[2] } };
  return { fileData: { mimeType: guessMime(url), fileUri: url } };
}

// ---------- 请求：IR → Gemini ----------

export function irRequestToGemini(
  ir: Json,
  options: { reasoning?: ReasoningIntent; modelId?: string; control?: 'level' | 'budget' | 'none' } = {},
): Json {
  const contents: Json[] = [];
  const systemParts: Json[] = [];
  // IR tool 消息只有 tool_call_id，Gemini functionResponse 需要函数名：
  // 顺序扫描时记录 tool_call_id → name 映射
  const toolNameByCallId = new Map<string, string>();

  for (const m of (ir.messages as Json[]) ?? []) {
    if (m.role === 'system' || m.role === 'developer') {
      const t = textOf(m.content);
      if (t) systemParts.push({ text: t });
    } else if (m.role === 'user') {
      const parts: Json[] = [];
      if (typeof m.content === 'string') {
        if (m.content) parts.push({ text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'text' && p.text) parts.push({ text: p.text });
          else if (p.type === 'image_url') {
            const img = irImageToGemini(p);
            if (img) parts.push(img);
          }
        }
      }
      contents.push({ role: 'user', parts: parts.length ? parts : [{ text: '' }] });
    } else if (m.role === 'assistant') {
      const parts: Json[] = [];
      const t = textOf(m.content);
      if (t) parts.push({ text: t });
      for (const tc of (m.tool_calls as Json[]) ?? []) {
        const name = tc.function?.name ?? '';
        if (tc.id && name) toolNameByCallId.set(tc.id, name);
        const signature = toolCallThoughtSignature(m, tc);
        parts.push({
          ...(signature ? { thoughtSignature: signature } : {}),
          functionCall: { name, args: parseJsonSafe(tc.function?.arguments ?? '{}') },
        });
      }
      contents.push({ role: 'model', parts: parts.length ? parts : [{ text: '' }] });
    } else if (m.role === 'tool') {
      const name = toolNameByCallId.get(m.tool_call_id) ?? 'unknown';
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name, response: { result: textOf(m.content) } } }],
      });
    }
  }

  const out: Json = { contents };
  if (systemParts.length) out.systemInstruction = { parts: systemParts };

  const generationConfig: Json = {};
  if (ir.temperature !== undefined) generationConfig.temperature = ir.temperature;
  if (ir.top_p !== undefined) generationConfig.topP = ir.top_p;
  const maxTokens = ir.max_tokens ?? ir.max_completion_tokens;
  if (maxTokens !== undefined) generationConfig.maxOutputTokens = maxTokens;
  if (ir.stop !== undefined) generationConfig.stopSequences = Array.isArray(ir.stop) ? ir.stop : [ir.stop];
  if (Object.keys(generationConfig).length) out.generationConfig = generationConfig;
  if (options.reasoning && options.modelId) {
    applyGeminiReasoning(out, options.reasoning, options.modelId, { control: options.control });
  }

  const tools = (ir.tools as Json[]) ?? [];
  if (tools.length && ir.tool_choice !== 'none') {
    out.tools = [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.function?.name,
          description: t.function?.description,
          parameters: t.function?.parameters ?? { type: 'object', properties: {} },
        })),
      },
    ];
  }
  return out;
}

// ---------- 响应：Gemini → IR ----------

function geminiFinishToIR(finish: string | undefined, hasFunctionCall: boolean): string {
  if (hasFunctionCall) return 'tool_calls';
  switch (finish) {
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
      return 'content_filter';
    default:
      return 'stop';
  }
}

function geminiUsageToIR(u: Json | undefined): UsageInfo | null {
  return toPublicUsage(normalizeGeminiUsage(u));
}

export function geminiUsageFromJson(json: Json): UsageInfo | null {
  return normalizeGeminiUsage(json?.usageMetadata);
}

export function geminiResponseToIR(json: Json, model: string): Json {
  const cand = (json.candidates as Json[])?.[0] ?? {};
  const parts = (cand.content?.parts as Json[]) ?? [];
  // thought 片段是思考摘要，不属于正文
  const text = parts.filter((p) => typeof p.text === 'string' && p.thought !== true).map((p) => p.text).join('');
  const fnParts = parts.filter((p) => p.functionCall);
  const toolCalls = fnParts.map(openAIToolCall);
  const message: Json = { role: 'assistant', content: text || null };
  if (toolCalls.length) {
    message.tool_calls = toolCalls;
    const details = toolCalls.map(encryptedReasoningDetail).filter(Boolean);
    if (details.length) message.reasoning_details = details;
  }
  return {
    id: `chatcmpl-gemini-${Math.random().toString(36).slice(2, 10)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      { index: 0, message, finish_reason: geminiFinishToIR(cand.finishReason, fnParts.length > 0) },
    ],
    usage: geminiUsageToIR(json.usageMetadata) ?? undefined,
  };
}

// ---------- 流式：Gemini SSE → IR SSE ----------

/**
 * :streamGenerateContent?alt=sse 的 data 是完整 generateContent 响应 JSON（增量 parts）。
 * functionCall 转成 tool_calls：首个 functionCall chunk 发 id+name，args 一次性随附
 * （Gemini 流式一般一次给完整 functionCall，不做分片）。
 */
export function geminiStreamToIR(
  upstream: ReadableStream<Uint8Array>,
  opts: { model: string; includeUsage: boolean },
): { stream: ReadableStream<Uint8Array>; usage: Promise<UsageInfo | null> } {
  const usageDef = deferred<UsageInfo | null>();
  let observedUsage: UsageInfo | null = null;

  async function* gen(): AsyncGenerator<Uint8Array> {
    const base = {
      id: `chatcmpl-gemini-${Math.random().toString(36).slice(2, 10)}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: opts.model,
    };
    const chunk = (delta: Json, finishReason: string | null = null) =>
      encodeSSE(null, { ...base, choices: [{ index: 0, delta, finish_reason: finishReason }] });

    let roleSent = false;
    let toolCount = 0;
    let finishReason: string | null = null;

    for await (const evt of parseSSE(upstream)) {
      let data: Json;
      try {
        data = JSON.parse(evt.data);
      } catch {
        continue;
      }
      const u = normalizeGeminiUsage(data.usageMetadata);
      if (u) observedUsage = u;
      const cand = (data.candidates as Json[])?.[0];
      if (!cand) continue;
      if (!roleSent) {
        roleSent = true;
        yield chunk({ role: 'assistant', content: '' });
      }
      for (const p of (cand.content?.parts as Json[]) ?? []) {
        if (typeof p.text === 'string' && p.text && p.thought !== true) {
          yield chunk({ content: p.text });
        } else if (p.functionCall) {
          const toolCall = openAIToolCall(p, toolCount++);
          const detail = encryptedReasoningDetail(toolCall);
          yield chunk({
            tool_calls: [toolCall],
            ...(detail ? { reasoning_details: [detail] } : {}),
          });
        }
      }
      if (cand.finishReason) {
        finishReason = geminiFinishToIR(cand.finishReason, toolCount > 0);
      }
    }

    yield chunk({}, finishReason ?? 'stop');
    if (opts.includeUsage && observedUsage) {
      yield encodeSSE(null, { ...base, choices: [], usage: toPublicUsage(observedUsage) });
    }
    yield encodeSSE(null, '[DONE]');
    usageDef.resolve(observedUsage);
  }

  // 正常结束、异常和客户端取消都必须结算 usage Promise，避免日志 after() 永久悬挂。
  const stream = generatorToStream(gen(), () => usageDef.resolve(observedUsage));
  return { stream, usage: usageDef.promise };
}

/** Gemini 端点 URL。 */
export function geminiUrl(baseUrl: string, modelId: string, stream: boolean): string {
  const base = baseUrl.replace(/\/+$/, '');
  return stream
    ? `${base}/v1beta/models/${encodeURIComponent(modelId)}:streamGenerateContent?alt=sse`
    : `${base}/v1beta/models/${encodeURIComponent(modelId)}:generateContent`;
}
