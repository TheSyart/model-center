/**
 * OpenAI Responses API ↔ IR（OpenAI Chat Completions）双向转换（§3.2）。
 * 同时服务于：
 *  - openai-responses 上游适配器（IR → Responses 请求；Responses 响应/流 → IR）
 *  - /v1/responses 出口（Responses 请求 → IR；IR 响应/流 → Responses）
 * id 稳定性：function_call 的 call_id ↔ IR tool_calls.id 直接互用；
 * 出口侧的 output_item item_id（fc_*）由网关生成并在事件序列内保持一致。
 */
import { encodeSSE, generatorToStream, observeSSEStream, parseSSE, deferred } from './sse';
import type { UsageInfo } from '@/lib/gateway/logger';
import { normalizeResponsesUsage, toPublicUsage } from '@/lib/services/usage-metrics';

type Json = Record<string, any>;

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 26)}`;
}

// ---------- 请求：Responses → IR（/v1/responses 入口用） ----------

function responsesContentToIRParts(content: unknown): { text: string; parts: Json[] } {
  // 返回 { text: 纯文本拼接, parts: 含图片的多模态 parts }
  const parts: Json[] = [];
  let text = '';
  if (typeof content === 'string') return { text: content, parts: [{ type: 'text', text: content }] };
  for (const p of (content as Json[]) ?? []) {
    if (p?.type === 'input_text' || p?.type === 'output_text') {
      text += p.text ?? '';
      parts.push({ type: 'text', text: p.text ?? '' });
    } else if (p?.type === 'input_image' && p.image_url) {
      parts.push({ type: 'image_url', image_url: { url: p.image_url } });
    }
  }
  return { text, parts };
}

export function responsesRequestToIR(body: Json): Json {
  const messages: Json[] = [];
  if (body.instructions) messages.push({ role: 'system', content: String(body.instructions) });

  const input = body.input;
  if (typeof input === 'string') {
    messages.push({ role: 'user', content: input });
  } else if (Array.isArray(input)) {
    // 连续的 function_call items 合并进一条 assistant 消息的 tool_calls
    let pendingAssistant: Json | null = null;
    const flushAssistant = () => {
      if (pendingAssistant) {
        messages.push(pendingAssistant);
        pendingAssistant = null;
      }
    };
    for (const item of input as Json[]) {
      const type = item?.type;
      if (type === 'function_call') {
        if (!pendingAssistant) pendingAssistant = { role: 'assistant', content: null, tool_calls: [] };
        pendingAssistant.tool_calls.push({
          id: item.call_id ?? item.id,
          type: 'function',
          function: { name: item.name, arguments: item.arguments ?? '' },
        });
      } else if (type === 'function_call_output') {
        flushAssistant();
        messages.push({ role: 'tool', tool_call_id: item.call_id, content: typeof item.output === 'string' ? item.output : JSON.stringify(item.output ?? '') });
      } else {
        // message item（type: 'message' 或省略 type 仅带 role）
        flushAssistant();
        const role = item.role === 'assistant' ? 'assistant' : item.role === 'system' ? 'system' : 'user';
        const { text, parts } = responsesContentToIRParts(item.content);
        const hasImage = parts.some((p) => p.type === 'image_url');
        messages.push({ role, content: hasImage ? parts : text });
      }
    }
    flushAssistant();
  }

  const out: Json = { model: body.model, messages };
  if (body.max_output_tokens !== undefined) out.max_tokens = body.max_output_tokens;
  if (body.temperature !== undefined) out.temperature = body.temperature;
  if (body.top_p !== undefined) out.top_p = body.top_p;
  if (body.stream === true) out.stream = true;
  const tools = (body.tools as Json[]) ?? [];
  const fnTools = tools.filter((t) => t?.type === 'function');
  if (fnTools.length) {
    out.tools = fnTools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters ?? { type: 'object', properties: {} } },
    }));
  }
  const tc = body.tool_choice;
  if (tc !== undefined) {
    if (tc && typeof tc === 'object' && tc.type === 'function') out.tool_choice = { type: 'function', function: { name: tc.name } };
    else out.tool_choice = tc; // auto/required/none 原样
  }
  return out;
}

// ---------- 请求：IR → Responses（上游适配器用） ----------

export function irRequestToResponses(ir: Json, modelId: string): Json {
  const instructions: string[] = [];
  const input: Json[] = [];

  for (const m of (ir.messages as Json[]) ?? []) {
    if (m.role === 'system' || m.role === 'developer') {
      const t = typeof m.content === 'string' ? m.content : '';
      if (t) instructions.push(t);
    } else if (m.role === 'user') {
      const content: Json[] = [];
      if (typeof m.content === 'string') {
        content.push({ type: 'input_text', text: m.content });
      } else {
        for (const p of (m.content as Json[]) ?? []) {
          if (p.type === 'text') content.push({ type: 'input_text', text: p.text ?? '' });
          else if (p.type === 'image_url' && p.image_url?.url) content.push({ type: 'input_image', image_url: p.image_url.url });
        }
      }
      input.push({ type: 'message', role: 'user', content: content.length ? content : [{ type: 'input_text', text: '' }] });
    } else if (m.role === 'assistant') {
      const t = typeof m.content === 'string' ? m.content : '';
      if (t) {
        input.push({ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: t }] });
      }
      for (const tc of (m.tool_calls as Json[]) ?? []) {
        input.push({
          type: 'function_call',
          call_id: tc.id,
          name: tc.function?.name,
          arguments: tc.function?.arguments ?? '',
        });
      }
    } else if (m.role === 'tool') {
      input.push({ type: 'function_call_output', call_id: m.tool_call_id, output: typeof m.content === 'string' ? m.content : '' });
    }
  }

  const out: Json = { model: modelId, input };
  if (instructions.length) out.instructions = instructions.join('\n\n');
  if (ir.max_tokens !== undefined) out.max_output_tokens = ir.max_tokens;
  if (ir.temperature !== undefined) out.temperature = ir.temperature;
  if (ir.top_p !== undefined) out.top_p = ir.top_p;
  if (ir.stream === true) out.stream = true;
  const tools = (ir.tools as Json[]) ?? [];
  if (tools.length) {
    out.tools = tools.map((t) => ({
      type: 'function',
      name: t.function?.name,
      description: t.function?.description,
      parameters: t.function?.parameters ?? { type: 'object', properties: {} },
    }));
  }
  const tc = ir.tool_choice;
  if (tc !== undefined) {
    if (tc && typeof tc === 'object' && tc.type === 'function') out.tool_choice = { type: 'function', name: tc.function?.name };
    else out.tool_choice = tc;
  }
  return out;
}

// ---------- 非流式响应：Responses → IR ----------

function responsesUsageToIR(u: Json | undefined): UsageInfo | null {
  return toPublicUsage(normalizeResponsesUsage(u));
}

function responsesStatusToFinish(json: Json, hasToolCalls: boolean): string {
  if (hasToolCalls) return 'tool_calls';
  if (json.status === 'incomplete') {
    return json.incomplete_details?.reason === 'max_output_tokens' ? 'length' : 'stop';
  }
  return 'stop';
}

export function responsesResponseToIR(json: Json, model: string): Json {
  let text = '';
  const toolCalls: Json[] = [];
  for (const item of (json.output as Json[]) ?? []) {
    if (item.type === 'message') {
      for (const p of (item.content as Json[]) ?? []) {
        if (p.type === 'output_text') text += p.text ?? '';
      }
    } else if (item.type === 'function_call') {
      toolCalls.push({
        id: item.call_id ?? item.id,
        type: 'function',
        index: toolCalls.length,
        function: { name: item.name, arguments: item.arguments ?? '' },
      });
    }
  }
  const message: Json = { role: 'assistant', content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;
  return {
    id: json.id ?? rid('chatcmpl'),
    object: 'chat.completion',
    created: json.created_at ?? Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: responsesStatusToFinish(json, toolCalls.length > 0) }],
    usage: responsesUsageToIR(json.usage) ?? undefined,
  };
}

// ---------- 非流式响应：IR → Responses（出口用） ----------

export function irResponseToResponses(json: Json, model: string): Json {
  const choice = json.choices?.[0] ?? {};
  const message = choice.message ?? {};
  const output: Json[] = [];
  const text = typeof message.content === 'string' ? message.content : '';
  if (text) {
    output.push({ type: 'message', id: rid('msg'), status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] });
  }
  for (const tc of (message.tool_calls as Json[]) ?? []) {
    output.push({
      type: 'function_call',
      id: rid('fc'),
      call_id: tc.id,
      name: tc.function?.name,
      arguments: tc.function?.arguments ?? '',
      status: 'completed',
    });
  }
  const finish = choice.finish_reason;
  const incomplete = finish === 'length';
  const u = json.usage ?? {};
  return {
    id: rid('resp'),
    object: 'response',
    created_at: json.created ?? Math.floor(Date.now() / 1000),
    status: incomplete ? 'incomplete' : 'completed',
    incomplete_details: incomplete ? { reason: 'max_output_tokens' } : null,
    model,
    output: output.length ? output : [{ type: 'message', id: rid('msg'), status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '', annotations: [] }] }],
    usage: {
      input_tokens: u.prompt_tokens ?? 0,
      output_tokens: u.completion_tokens ?? 0,
      total_tokens: u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0),
    },
  };
}

// ---------- 流式：Responses SSE → IR SSE（上游适配器用） ----------

export interface TranslatedStream {
  stream: ReadableStream<Uint8Array>;
  usage: Promise<UsageInfo | null>;
}

/**
 * Responses SSE 事件 → OpenAI chat.completion.chunk SSE。
 * item_id → tool_calls index 映射在事件序列内保持稳定（同一 function_call item 的
 * arguments delta 都携带同一 item_id）；finish_reason 由 response.completed 的
 * status + 是否出现 function_call 推导。
 */
export function responsesStreamToIR(
  upstream: ReadableStream<Uint8Array>,
  opts: { model: string; includeUsage: boolean },
): TranslatedStream {
  const usageDef = deferred<UsageInfo | null>();
  let observedUsage: UsageInfo | null = null;

  async function* gen(): AsyncGenerator<Uint8Array> {
    const base = {
      id: rid('chatcmpl'),
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: opts.model,
    };
    const chunk = (delta: Json, finishReason: string | null = null) =>
      encodeSSE(null, { ...base, choices: [{ index: 0, delta, finish_reason: finishReason }] });

    const toolIndexByItemId = new Map<string, number>();
    let toolCount = 0;
    let roleSent = false;
    let finishReason: string | null = null;

    const ensureRole = function* () {
      if (!roleSent) {
        roleSent = true;
        yield chunk({ role: 'assistant', content: '' });
      }
    };

    for await (const evt of parseSSE(upstream)) {
      let data: Json;
      try {
        data = JSON.parse(evt.data);
      } catch {
        continue;
      }
      const type = evt.event ?? data.type;
      switch (type) {
        case 'response.output_item.added': {
          const item = data.item ?? {};
          if (item.type === 'function_call') {
            yield* ensureRole();
            const ti = toolCount++;
            toolIndexByItemId.set(item.id ?? data.item_id, ti);
            yield chunk({
              tool_calls: [{ index: ti, id: item.call_id ?? item.id, type: 'function', function: { name: item.name ?? '', arguments: '' } }],
            });
          }
          break;
        }
        case 'response.output_text.delta': {
          yield* ensureRole();
          yield chunk({ content: data.delta ?? '' });
          break;
        }
        case 'response.function_call_arguments.delta': {
          const ti = toolIndexByItemId.get(data.item_id);
          if (ti !== undefined) {
            yield chunk({ tool_calls: [{ index: ti, function: { arguments: data.delta ?? '' } }] });
          }
          break;
        }
        case 'response.completed':
        case 'response.incomplete': {
          const resp = data.response ?? {};
          observedUsage = normalizeResponsesUsage(resp.usage) ?? observedUsage;
          finishReason = responsesStatusToFinish(resp, toolCount > 0);
          break;
        }
        case 'response.failed': {
          throw new Error(`上游 Responses 错误: ${JSON.stringify(data.response?.error ?? data).slice(0, 400)}`);
        }
        default:
          break; // response.created / in_progress / content_part.* / output_item.done 等
      }
    }

    yield* ensureRole();
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

// ---------- 流式：IR SSE → Responses SSE（出口用） ----------

/**
 * OpenAI chat.completion.chunk SSE → Responses SSE 事件序列。
 * 事件序：response.created → response.in_progress → （文本）output_item.added(message) →
 * content_part.added → output_text.delta* → content_part.done → output_item.done →
 * （工具）output_item.added(function_call) → function_call_arguments.delta* → output_item.done →
 * response.completed（含 usage）。
 * tool_calls.index → output_index / item_id / call_id 全程稳定映射。
 */
export function irStreamToResponses(
  irStream: ReadableStream<Uint8Array>,
  opts: { model: string },
): ReadableStream<Uint8Array> {
  async function* gen(): AsyncGenerator<Uint8Array> {
    const respId = rid('resp');
    let started = false;
    let usage: UsageInfo | null = null;
    let finishReason: string | null = null;

    // 输出项状态
    interface OpenItem {
      kind: 'message' | 'function_call';
      itemId: string;
      outputIndex: number;
      callId?: string;
      name?: string;
      arguments?: string;
      /** message 项累积的完整文本（用于 content_part.done / 最终 response 对象） */
      text?: string;
    }
    let openItem: OpenItem | null = null;
    const items: OpenItem[] = [];
    // IR tool_calls index → OpenItem
    const toolItems = new Map<number, OpenItem>();
    let outputIndexCounter = 0;

    const emitStart = function* () {
      if (started) return;
      started = true;
      const baseResp = { id: respId, object: 'response', created_at: Math.floor(Date.now() / 1000), status: 'in_progress', model: opts.model, output: [] };
      yield encodeSSE('response.created', { type: 'response.created', response: baseResp });
      yield encodeSSE('response.in_progress', { type: 'response.in_progress', response: baseResp });
    };

    const closeItem = function* () {
      if (!openItem) return;
      if (openItem.kind === 'message') {
        yield encodeSSE('response.content_part.done', {
          type: 'response.content_part.done', item_id: openItem.itemId, output_index: openItem.outputIndex, content_index: 0,
          part: { type: 'output_text', text: openItem.text ?? '', annotations: [] },
        });
      }
      const doneItem: Json =
        openItem.kind === 'message'
          ? { type: 'message', id: openItem.itemId, status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: openItem.text ?? '', annotations: [] }] }
          : { type: 'function_call', id: openItem.itemId, call_id: openItem.callId, name: openItem.name, arguments: openItem.arguments ?? '', status: 'completed' };
      yield encodeSSE('response.output_item.done', { type: 'response.output_item.done', output_index: openItem.outputIndex, item: doneItem });
      items.push(openItem);
      openItem = null;
    };

    const openTextItem = function* () {
      const item: OpenItem = { kind: 'message', itemId: rid('msg'), outputIndex: outputIndexCounter++ };
      yield encodeSSE('response.output_item.added', {
        type: 'response.output_item.added', output_index: item.outputIndex,
        item: { type: 'message', id: item.itemId, status: 'in_progress', role: 'assistant', content: [] },
      });
      yield encodeSSE('response.content_part.added', {
        type: 'response.content_part.added', item_id: item.itemId, output_index: item.outputIndex, content_index: 0,
        part: { type: 'output_text', text: '', annotations: [] },
      });
      openItem = item;
    };

    for await (const evt of parseSSE(irStream)) {
      if (evt.data === '[DONE]') break;
      let chunkData: Json;
      try {
        chunkData = JSON.parse(evt.data);
      } catch {
        continue;
      }
      if (chunkData.usage) usage = chunkData.usage as UsageInfo;
      const choice = (chunkData.choices as Json[])?.[0];
      if (!choice) continue;
      yield* emitStart();
      const delta = choice.delta ?? {};

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        if (!openItem || openItem.kind !== 'message') {
          yield* closeItem();
          yield* openTextItem();
        }
        openItem!.text = (openItem!.text ?? '') + delta.content;
        yield encodeSSE('response.output_text.delta', {
          type: 'response.output_text.delta', item_id: openItem!.itemId, output_index: openItem!.outputIndex, content_index: 0, delta: delta.content,
        });
      }

      for (const tc of (delta.tool_calls as Json[]) ?? []) {
        const ti = tc.index ?? 0;
        if (tc.id !== undefined || tc.function?.name !== undefined) {
          // 新 function_call item
          yield* closeItem();
          const item: OpenItem = {
            kind: 'function_call',
            itemId: rid('fc'),
            outputIndex: outputIndexCounter++,
            callId: tc.id ?? rid('call'),
            name: tc.function?.name ?? '',
            arguments: '',
          };
          toolItems.set(ti, item);
          yield encodeSSE('response.output_item.added', {
            type: 'response.output_item.added', output_index: item.outputIndex,
            item: { type: 'function_call', id: item.itemId, call_id: item.callId, name: item.name, arguments: '', status: 'in_progress' },
          });
          openItem = item;
        }
        if (tc.function?.arguments) {
          const item = toolItems.get(ti);
          if (item) {
            item.arguments = (item.arguments ?? '') + tc.function.arguments;
            yield encodeSSE('response.function_call_arguments.delta', {
              type: 'response.function_call_arguments.delta', item_id: item.itemId, output_index: item.outputIndex, delta: tc.function.arguments,
            });
          }
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason;
    }

    yield* emitStart();
    yield* closeItem();

    // 组装最终 response 对象
    const output: Json[] = items.map((it) =>
      it.kind === 'message'
        ? { type: 'message', id: it.itemId, status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: it.text ?? '', annotations: [] }] }
        : { type: 'function_call', id: it.itemId, call_id: it.callId, name: it.name, arguments: it.arguments ?? '', status: 'completed' },
    );
    const incomplete = finishReason === 'length';
    const finalResp: Json = {
      id: respId,
      object: 'response',
      created_at: Math.floor(Date.now() / 1000),
      status: incomplete ? 'incomplete' : 'completed',
      incomplete_details: incomplete ? { reason: 'max_output_tokens' } : null,
      model: opts.model,
      output,
    };
    if (usage) {
      finalResp.usage = { input_tokens: usage.prompt_tokens ?? 0, output_tokens: usage.completion_tokens ?? 0, total_tokens: usage.total_tokens ?? 0 };
    }
    yield encodeSSE(incomplete ? 'response.incomplete' : 'response.completed', { type: incomplete ? 'response.incomplete' : 'response.completed', response: finalResp });
  }

  return generatorToStream(gen(), () => {});
}

// ---------- 原生透传时的 usage 提取（日志用） ----------

export function responsesUsageFromJson(json: Json): UsageInfo | null {
  return normalizeResponsesUsage(json?.usage);
}

export async function extractResponsesUsageFromSSE(stream: ReadableStream<Uint8Array>): Promise<UsageInfo | null> {
  let usage: UsageInfo | null = null;
  try {
    for await (const evt of parseSSE(stream)) {
      try {
        const data = JSON.parse(evt.data);
        const event = evt.event ?? data.type;
        if (event !== 'response.completed' && event !== 'response.incomplete') continue;
        usage = normalizeResponsesUsage(data.response?.usage) ?? usage;
      } catch {
        // 忽略
      }
    }
  } catch {
    // 流中断也返回已收集部分
  }
  return usage;
}

/** 原字节透传并随客户端背压增量提取 Responses usage。 */
export function observeResponsesUsageFromSSE(
  stream: ReadableStream<Uint8Array>,
): { stream: ReadableStream<Uint8Array>; usage: Promise<UsageInfo | null> } {
  let usage: UsageInfo | null = null;
  const observed = observeSSEStream(stream, (evt) => {
    try {
      const data = JSON.parse(evt.data);
      const event = evt.event ?? data.type;
      if (event !== 'response.completed' && event !== 'response.incomplete') return;
      usage = normalizeResponsesUsage(data.response?.usage) ?? usage;
    } catch {
      // 忽略非 JSON
    }
  });
  return { stream: observed.stream, usage: observed.done.then(() => usage) };
}
