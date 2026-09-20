/**
 * Anthropic Messages ↔ IR（OpenAI Chat Completions）双向转换（§3.2）。
 * 同时服务于：
 *  - anthropic 上游适配器（IR → Anthropic 请求；Anthropic 响应/流 → IR）
 *  - /v1/messages 出口（Anthropic 请求 → IR；IR 响应/流 → Anthropic）
 * 字段尽力映射：temperature / top_p / stop↔stop_sequences / max_tokens / tools / tool_choice / 图片。
 */
import { encodeSSE, generatorToStream, observeSSEStream, parseSSE, deferred } from './sse';
import { applyAnthropicReasoning, stripRejectedClaudeSampling } from './reasoning-emit';
import type { ReasoningIntent } from '@/lib/gateway/reasoning';
import type { UsageInfo } from '@/lib/services/usage-metrics';
import { normalizeAnthropicUsage, normalizeOpenAIUsage, toPublicUsage } from '@/lib/services/usage-metrics';

type Json = Record<string, any>;

const DEFAULT_MAX_TOKENS = 8192;

// ---------- 公共小工具 ----------

/** content 既可能是字符串也可能是 parts 数组，提取纯文本。 */
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

/** IR image_url part → Anthropic image block。 */
function irImageToAnthropic(part: Json): Json | null {
  const url: string = part?.image_url?.url ?? '';
  if (!url) return null;
  const m = /^data:([^;]+);base64,(.*)$/s.exec(url);
  if (m) {
    return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } };
  }
  return { type: 'image', source: { type: 'url', url } };
}

/** Anthropic image block → IR image_url part。 */
function anthropicImageToIR(block: Json): Json | null {
  const src = block?.source;
  if (!src) return null;
  if (src.type === 'base64') {
    return { type: 'image_url', image_url: { url: `data:${src.media_type};base64,${src.data}` } };
  }
  if (src.type === 'url') {
    return { type: 'image_url', image_url: { url: src.url } };
  }
  return null;
}

/** Anthropic stop_reason → OpenAI finish_reason。 */
export function anthropicStopToIR(stop: string | null | undefined): string | null {
  switch (stop) {
    case 'end_turn':
    case 'stop_sequence':
      return 'stop';
    case 'max_tokens':
      return 'length';
    case 'tool_use':
      return 'tool_calls';
    default:
      return stop ? 'stop' : null;
  }
}

/** OpenAI finish_reason → Anthropic stop_reason。 */
export function irStopToAnthropic(finish: string | null | undefined): string {
  switch (finish) {
    case 'length':
      return 'max_tokens';
    case 'tool_calls':
      return 'tool_use';
    case 'content_filter':
      return 'refusal';
    default:
      return 'end_turn';
  }
}

// ---------- 请求：IR → Anthropic（上游适配器用） ----------

export function irRequestToAnthropic(ir: Json, modelId: string, reasoning?: ReasoningIntent): Json {
  const systemParts: string[] = [];
  const merged: Json[] = [];
  const push = (role: string, blocks: Json[]) => {
    const last = merged[merged.length - 1];
    if (last && last.role === role) {
      last.content.push(...blocks); // Anthropic 要求 user/assistant 严格交替，合并相邻同角色消息
    } else {
      merged.push({ role, content: [...blocks] });
    }
  };

  for (const m of (ir.messages as Json[]) ?? []) {
    if (m.role === 'system' || m.role === 'developer') {
      const t = textOf(m.content);
      if (t) systemParts.push(t);
    } else if (m.role === 'user') {
      const blocks: Json[] = [];
      if (typeof m.content === 'string') {
        if (m.content) blocks.push({ type: 'text', text: m.content });
      } else if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'text' && p.text) blocks.push({ type: 'text', text: p.text });
          else if (p.type === 'image_url') {
            const img = irImageToAnthropic(p);
            if (img) blocks.push(img);
          }
        }
      }
      push('user', blocks.length ? blocks : [{ type: 'text', text: '' }]);
    } else if (m.role === 'assistant') {
      const blocks: Json[] = [];
      const t = textOf(m.content);
      if (t) blocks.push({ type: 'text', text: t });
      for (const tc of (m.tool_calls as Json[]) ?? []) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function?.name,
          input: parseJsonSafe(tc.function?.arguments ?? '{}'),
        });
      }
      push('assistant', blocks.length ? blocks : [{ type: 'text', text: '' }]);
    } else if (m.role === 'tool') {
      push('user', [
        { type: 'tool_result', tool_use_id: m.tool_call_id, content: textOf(m.content) },
      ]);
    }
  }

  const out: Json = {
    model: modelId,
    max_tokens: ir.max_tokens ?? ir.max_completion_tokens ?? DEFAULT_MAX_TOKENS,
    messages: merged,
  };
  if (systemParts.length) out.system = systemParts.join('\n\n');
  if (ir.temperature !== undefined) out.temperature = ir.temperature;
  if (ir.top_p !== undefined) out.top_p = ir.top_p;
  if (ir.stop !== undefined) out.stop_sequences = Array.isArray(ir.stop) ? ir.stop : [ir.stop];
  if (ir.stream === true) out.stream = true;

  const tools = (ir.tools as Json[]) ?? [];
  if (tools.length && ir.tool_choice !== 'none') {
    out.tools = tools.map((t) => ({
      name: t.function?.name,
      description: t.function?.description,
      input_schema: t.function?.parameters ?? { type: 'object', properties: {} },
    }));
    const tc = ir.tool_choice;
    if (tc === 'required') out.tool_choice = { type: 'any' };
    else if (tc && typeof tc === 'object' && tc.type === 'function') {
      out.tool_choice = { type: 'tool', name: tc.function?.name };
    } else out.tool_choice = { type: 'auto' };
  }
  stripRejectedClaudeSampling(out, modelId);
  if (reasoning) applyAnthropicReasoning(out, reasoning, modelId);
  return out;
}

// ---------- 请求：Anthropic → IR（/v1/messages 入口用） ----------

export function anthropicRequestToIR(body: Json): Json {
  const messages: Json[] = [];
  const systemText = typeof body.system === 'string' ? body.system : textOf(body.system);
  if (systemText) messages.push({ role: 'system', content: systemText });

  for (const m of (body.messages as Json[]) ?? []) {
    const content = m.content;
    if (typeof content === 'string') {
      messages.push({ role: m.role, content });
      continue;
    }
    const blocks = (content as Json[]) ?? [];
    if (m.role === 'user') {
      const parts: Json[] = [];
      for (const b of blocks) {
        if (b.type === 'text') parts.push({ type: 'text', text: b.text ?? '' });
        else if (b.type === 'image') {
          const img = anthropicImageToIR(b);
          if (img) parts.push(img);
        } else if (b.type === 'tool_result') {
          // tool_result 块 → 独立的 IR tool 消息
          messages.push({ role: 'tool', tool_call_id: b.tool_use_id, content: textOf(b.content) });
        }
      }
      if (parts.length) messages.push({ role: 'user', content: parts });
    } else if (m.role === 'assistant') {
      let text = '';
      const toolCalls: Json[] = [];
      for (const b of blocks) {
        if (b.type === 'text') text += b.text ?? '';
        else if (b.type === 'tool_use') {
          toolCalls.push({
            id: b.id,
            type: 'function',
            function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
          });
        }
      }
      const msg: Json = { role: 'assistant', content: text || null };
      if (toolCalls.length) msg.tool_calls = toolCalls;
      messages.push(msg);
    }
  }

  const out: Json = { model: body.model, messages, max_tokens: body.max_tokens };
  if (body.temperature !== undefined) out.temperature = body.temperature;
  if (body.top_p !== undefined) out.top_p = body.top_p;
  if (body.stop_sequences !== undefined) out.stop = body.stop_sequences;
  if (body.stream === true) out.stream = true;
  const tools = (body.tools as Json[]) ?? [];
  if (tools.length) {
    out.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema ?? { type: 'object', properties: {} } },
    }));
  }
  const tc = body.tool_choice;
  if (tc) {
    if (tc.type === 'auto') out.tool_choice = 'auto';
    else if (tc.type === 'any') out.tool_choice = 'required';
    else if (tc.type === 'none') out.tool_choice = 'none';
    else if (tc.type === 'tool') out.tool_choice = { type: 'function', function: { name: tc.name } };
  }
  return out;
}

// ---------- 非流式响应：Anthropic → IR ----------

export function anthropicResponseToIR(json: Json, model: string): Json {
  const blocks = (json.content as Json[]) ?? [];
  const text = blocks.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  const toolCalls = blocks
    .filter((b) => b.type === 'tool_use')
    .map((b, i) => ({
      id: b.id,
      type: 'function',
      index: i,
      function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
    }));
  const u = json.usage ?? {};
  const message: Json = { role: 'assistant', content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;
  return {
    id: json.id ?? 'chatcmpl-anthropic',
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: anthropicStopToIR(json.stop_reason) }],
    usage: {
      prompt_tokens: u.input_tokens ?? 0,
      completion_tokens: u.output_tokens ?? 0,
      total_tokens: (u.input_tokens ?? 0) + (u.output_tokens ?? 0),
    },
  };
}

// ---------- 非流式响应：IR → Anthropic（出口用） ----------

export function irResponseToAnthropic(json: Json, model: string): Json {
  const choice = json.choices?.[0] ?? {};
  const message = choice.message ?? {};
  const blocks: Json[] = [];
  const t = typeof message.content === 'string' ? message.content : '';
  if (t) blocks.push({ type: 'text', text: t });
  for (const tc of (message.tool_calls as Json[]) ?? []) {
    blocks.push({
      type: 'tool_use',
      id: tc.id,
      name: tc.function?.name,
      input: parseJsonSafe(tc.function?.arguments ?? '{}'),
    });
  }
  const u = json.usage ?? {};
  return {
    id: json.id ? String(json.id).replace(/^chatcmpl/, 'msg') : `msg_${Date.now()}`,
    type: 'message',
    role: 'assistant',
    content: blocks.length ? blocks : [{ type: 'text', text: '' }],
    model,
    stop_reason: irStopToAnthropic(choice.finish_reason),
    stop_sequence: null,
    usage: { input_tokens: u.prompt_tokens ?? 0, output_tokens: u.completion_tokens ?? 0 },
  };
}

// ---------- 流式：Anthropic SSE → IR SSE（上游适配器用） ----------

export interface TranslatedStream {
  /** 转换后的字节流 */
  stream: ReadableStream<Uint8Array>;
  /** 流结束后解析出的 usage（尽力而为） */
  usage: Promise<UsageInfo | null>;
}

/**
 * Anthropic SSE → OpenAI chat.completion.chunk SSE。
 * tool_use 块映射为 tool_calls 增量：content_block_start 发出 id/name，
 * input_json_delta 的 partial_json 作为 arguments 分片；
 * Anthropic content block index → 按出现顺序映射为连续 tool_calls index。
 */
export function anthropicStreamToIR(
  upstream: ReadableStream<Uint8Array>,
  opts: { model: string; includeUsage: boolean },
): TranslatedStream {
  const usageDef = deferred<UsageInfo | null>();
  const box = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cacheObserved: false };

  async function* gen(): AsyncGenerator<Uint8Array> {
    const base = {
      id: `chatcmpl-${Math.random().toString(36).slice(2, 14)}`,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model: opts.model,
    };
    const chunk = (delta: Json, finishReason: string | null = null) =>
      encodeSSE(null, { ...base, choices: [{ index: 0, delta, finish_reason: finishReason }] });

    // anthropic content block index → tool_calls index（仅 tool_use 块占用）
    const blockToolIndex = new Map<number, number>();
    let toolCount = 0;
    let finishReason: string | null = null;

    for await (const evt of parseSSE(upstream)) {
      let data: Json;
      try {
        data = JSON.parse(evt.data);
      } catch {
        continue;
      }
      switch (evt.event ?? data.type) {
        case 'message_start': {
          const usage = data.message?.usage ?? {};
          box.input = usage.input_tokens ?? 0;
          box.cacheRead = usage.cache_read_input_tokens ?? 0;
          box.cacheWrite = usage.cache_creation_input_tokens ?? 0;
          box.cacheObserved = 'cache_read_input_tokens' in usage || 'cache_creation_input_tokens' in usage;
          yield chunk({ role: 'assistant', content: '' });
          break;
        }
        case 'content_block_start': {
          const block = data.content_block ?? {};
          if (block.type === 'tool_use') {
            blockToolIndex.set(data.index, toolCount++);
            yield chunk({
              tool_calls: [
                {
                  index: blockToolIndex.get(data.index),
                  id: block.id,
                  type: 'function',
                  function: { name: block.name ?? '', arguments: '' },
                },
              ],
            });
          }
          break;
        }
        case 'content_block_delta': {
          const delta = data.delta ?? {};
          if (delta.type === 'text_delta') {
            yield chunk({ content: delta.text ?? '' });
          } else if (delta.type === 'input_json_delta') {
            const ti = blockToolIndex.get(data.index);
            if (ti !== undefined) {
              yield chunk({ tool_calls: [{ index: ti, function: { arguments: delta.partial_json ?? '' } }] });
            }
          }
          break;
        }
        case 'message_delta': {
          if (data.usage?.output_tokens !== undefined) box.output = data.usage.output_tokens;
          if (data.delta?.stop_reason) finishReason = anthropicStopToIR(data.delta.stop_reason);
          break;
        }
        case 'error': {
          throw new Error(`上游 Anthropic 错误: ${data.error?.message ?? evt.data}`.slice(0, 500));
        }
        default:
          break; // content_block_stop / message_stop / ping 等
      }
    }

    yield chunk({}, finishReason ?? 'stop');
    if (opts.includeUsage) {
      const publicUsage = toPublicUsage(
        normalizeAnthropicUsage({
          input_tokens: box.input,
          output_tokens: box.output,
          ...(box.cacheObserved
            ? { cache_read_input_tokens: box.cacheRead, cache_creation_input_tokens: box.cacheWrite }
            : {}),
        }),
      );
      yield encodeSSE(null, {
        ...base,
        choices: [],
        usage: publicUsage,
      });
    }
    yield encodeSSE(null, '[DONE]');
  }

  const stream = generatorToStream(gen(), (err) => {
    const usage = normalizeAnthropicUsage({
      input_tokens: box.input,
      output_tokens: box.output,
      ...(box.cacheObserved
        ? { cache_read_input_tokens: box.cacheRead, cache_creation_input_tokens: box.cacheWrite }
        : {}),
    });
    if (err) usageDef.resolve(box.input || box.output || box.cacheRead || box.cacheWrite ? usage : null);
    else usageDef.resolve(usage);
  });
  return { stream, usage: usageDef.promise };
}

// ---------- 流式：IR SSE → Anthropic SSE（出口用） ----------

/**
 * OpenAI chat.completion.chunk SSE → Anthropic Messages SSE 事件序列。
 * tool_calls 增量（index 寻址）映射为 content block：新 index → content_block_start(tool_use)，
 * arguments 分片 → input_json_delta；文本增量 → text_delta。
 * 结束时保证 content_block_stop / message_delta / message_stop 闭环。
 */
export function irStreamToAnthropic(
  irStream: ReadableStream<Uint8Array>,
  opts: { model: string },
): ReadableStream<Uint8Array> {
  async function* gen(): AsyncGenerator<Uint8Array> {
    const msgId = `msg_${Math.random().toString(36).slice(2, 26)}`;
    let started = false;
    let openBlockIndex = -1;
    let openBlockIsTool = false;
    let blockCount = 0;
    // IR tool_calls index → anthropic content block index
    const toolBlock = new Map<number, number>();
    let outputTokens = 0;
    let ended = false;

    const closeBlock = function* () {
      if (openBlockIndex >= 0) {
        yield encodeSSE('content_block_stop', { type: 'content_block_stop', index: openBlockIndex });
        openBlockIndex = -1;
        openBlockIsTool = false;
      }
    };
    const ensureStart = function* () {
      if (!started) {
        started = true;
        yield encodeSSE('message_start', {
          type: 'message_start',
          message: {
            id: msgId,
            type: 'message',
            role: 'assistant',
            content: [],
            model: opts.model,
            stop_reason: null,
            stop_sequence: null,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        });
      }
    };
    const finish = function* (stopReason: string) {
      if (ended) return;
      ended = true;
      yield* closeBlock();
      yield encodeSSE('message_delta', {
        type: 'message_delta',
        delta: { stop_reason: stopReason, stop_sequence: null },
        usage: { output_tokens: outputTokens },
      });
      yield encodeSSE('message_stop', { type: 'message_stop' });
    };

    for await (const evt of parseSSE(irStream)) {
      if (evt.data === '[DONE]') break;
      let chunk: Json;
      try {
        chunk = JSON.parse(evt.data);
      } catch {
        continue;
      }
      if (chunk.usage) outputTokens = chunk.usage.completion_tokens ?? outputTokens;
      const choice = (chunk.choices as Json[])?.[0];
      if (!choice) continue; // usage-only chunk
      yield* ensureStart();
      const delta = choice.delta ?? {};

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        if (openBlockIndex < 0 || openBlockIsTool) {
          // 当前无打开块，或打开的是 tool_use 块：关闭后另起文本块
          yield* closeBlock();
          openBlockIndex = blockCount++;
          openBlockIsTool = false;
          yield encodeSSE('content_block_start', {
            type: 'content_block_start',
            index: openBlockIndex,
            content_block: { type: 'text', text: '' },
          });
        }
        yield encodeSSE('content_block_delta', {
          type: 'content_block_delta',
          index: openBlockIndex,
          delta: { type: 'text_delta', text: delta.content },
        });
      }

      for (const tc of (delta.tool_calls as Json[]) ?? []) {
        const ti = tc.index ?? 0;
        if (tc.id !== undefined || tc.function?.name !== undefined) {
          // 新 tool call：关闭当前块，开 tool_use 块
          yield* closeBlock();
          const bi = blockCount++;
          toolBlock.set(ti, bi);
          yield encodeSSE('content_block_start', {
            type: 'content_block_start',
            index: bi,
            content_block: { type: 'tool_use', id: tc.id ?? `toolu_${bi}`, name: tc.function?.name ?? '', input: {} },
          });
          openBlockIndex = bi;
          openBlockIsTool = true;
        }
        if (tc.function?.arguments) {
          const bi = toolBlock.get(ti);
          if (bi !== undefined) {
            yield encodeSSE('content_block_delta', {
              type: 'content_block_delta',
              index: bi,
              delta: { type: 'input_json_delta', partial_json: tc.function.arguments },
            });
          }
        }
      }

      if (choice.finish_reason) {
        yield* finish(irStopToAnthropic(choice.finish_reason));
      }
    }
    // 容错：流意外结束也补闭环
    if (started) {
      yield* finish('end_turn');
    }
  }

  return generatorToStream(gen(), () => {});
}

// ---------- 原生透传时的 usage 提取（日志用） ----------

export function anthropicUsageFromJson(json: Json): UsageInfo | null {
  return normalizeAnthropicUsage(json?.usage);
}

export async function extractAnthropicUsageFromSSE(stream: ReadableStream<Uint8Array>): Promise<UsageInfo | null> {
  let usage: Json = {};
  try {
    for await (const evt of parseSSE(stream)) {
      try {
        const data = JSON.parse(evt.data);
        if ((evt.event ?? data.type) === 'message_start') usage = { ...usage, ...(data.message?.usage ?? {}) };
        if ((evt.event ?? data.type) === 'message_delta') usage = { ...usage, ...(data.usage ?? {}) };
      } catch {
        // 忽略非 JSON
      }
    }
  } catch {
    // 流中断也返回已收集的部分
  }
  return Object.keys(usage).length ? normalizeAnthropicUsage(usage) : null;
}

/** 原字节透传并随客户端背压增量提取 Anthropic usage。 */
export function observeAnthropicUsageFromSSE(
  stream: ReadableStream<Uint8Array>,
): { stream: ReadableStream<Uint8Array>; usage: Promise<UsageInfo | null> } {
  let usage: Json = {};
  const observed = observeSSEStream(stream, (evt) => {
    if (!evt.data || evt.data === '[DONE]') return;
    try {
      const data = JSON.parse(evt.data);
      if ((evt.event ?? data.type) === 'message_start') usage = { ...usage, ...(data.message?.usage ?? {}) };
      if ((evt.event ?? data.type) === 'message_delta') usage = { ...usage, ...(data.usage ?? {}) };
    } catch {
      // 忽略非 JSON
    }
  });
  return {
    stream: observed.stream,
    usage: observed.done.then(() => (Object.keys(usage).length ? normalizeAnthropicUsage(usage) : null)),
  };
}

/** OpenAI SSE 透传时的 usage 提取（从 forward.ts 迁移，供适配器/管线共用）。 */
export async function extractOpenAIUsageFromSSE(stream: ReadableStream<Uint8Array>): Promise<UsageInfo | null> {
  let usage: UsageInfo | null = null;
  try {
    for await (const evt of parseSSE(stream)) {
      if (evt.data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(evt.data);
        if (parsed?.usage) usage = normalizeOpenAIUsage(parsed.usage);
      } catch {
        // 忽略
      }
    }
  } catch {
    // 流中断也返回已收集的部分
  }
  return usage;
}

/** 原字节透传并随客户端背压增量提取 OpenAI usage。 */
export function observeOpenAIUsageFromSSE(
  stream: ReadableStream<Uint8Array>,
): { stream: ReadableStream<Uint8Array>; usage: Promise<UsageInfo | null> } {
  let usage: UsageInfo | null = null;
  const observed = observeSSEStream(stream, (evt) => {
    if (evt.data === '[DONE]') return;
    try {
      const parsed = JSON.parse(evt.data);
      if (parsed?.usage) usage = normalizeOpenAIUsage(parsed.usage);
    } catch {
      // 忽略非 JSON
    }
  });
  return { stream: observed.stream, usage: observed.done.then(() => usage) };
}
