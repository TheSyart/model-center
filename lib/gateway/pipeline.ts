import { after } from 'next/server';
import { getAdapter } from '@/lib/adapters';
import type { AdapterContext, ProtocolAdapter } from '@/lib/adapters/types';
import { decrypt } from '@/lib/crypto';
import { GatewayError, protocolNotImplemented } from './errors';
import { fetchUpstream } from './forward';
import { writeRequestLog } from './logger';
import type { UsageInfo } from './logger';
import { observeReadableStream } from './stream-observer';
import { resolveModel } from './router';
import type { RouteTarget } from './router';
import { getPromptById, getPromptByName, renderPrompt } from '@/lib/services/prompt';
import { checkSpendLimit, SPEND_WINDOW_LABELS } from '@/lib/services/token';
import type { TokenRow } from '@/lib/services/token';
import {
  anthropicUsageFromJson,
  irResponseToAnthropic,
  irStreamToAnthropic,
  observeAnthropicUsageFromSSE,
  observeOpenAIUsageFromSSE,
} from '@/lib/protocols/anthropic';
import {
  irResponseToResponses,
  irStreamToResponses,
  observeResponsesUsageFromSSE,
  responsesUsageFromJson,
} from '@/lib/protocols/responses';
import { normalizeOpenAIUsage } from '@/lib/services/usage-metrics';

type Json = Record<string, any>;

/** 入口协议族：决定错误格式、响应出口转换与"原生透传"的判定 */
export type EntryProtocol = 'openai' | 'anthropic' | 'responses';

export interface PipelineInput {
  entry: EntryProtocol;
  /** 客户端原始请求体（已剥离网关扩展字段）；原生透传时直接转发 */
  rawBody: Json;
  /** IR（OpenAI Chat Completions）请求体；转换路径用 */
  ir: Json;
  /** 客户端请求的 model 字段原文（别名/slug 格式/裸模型名） */
  requestedModel: string;
  stream: boolean;
  /** OpenAI stream_options.include_usage（anthropic/responses 入口恒 true） */
  includeUsage: boolean;
  clientSignal: AbortSignal;
  /** Anthropic 入口客户端的 anthropic-version 头（原生透传时带上） */
  anthropicVersion?: string | null;
  /** 预设提示词注入（§7.1 扩展字段 prompt_id/prompt_name + prompt_vars） */
  prompt?: { id?: string; name?: string; vars?: Record<string, unknown> };
  /** 网关令牌（鉴权已通过）；用于限额检查与日志 token_id */
  token?: TokenRow;
  /** 由入口 User-Agent 归一化出的客户端来源。 */
  source?: string;
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
} as const;

/** 入口协议对应的服务商原生协议（一致则原生透传，§3.2）。 */
const ENTRY_NATIVE_PROTOCOL: Record<EntryProtocol, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  responses: 'openai-responses',
};

/** 是否可 failover 的上游失败：网络错误（本网关记 502）/ 5xx / 429；其它 4xx 属客户端错误不降级。 */
function isFailoverable(status: number): boolean {
  return status === 429 || status >= 500;
}

/** 原生透传时的上游请求（仅改写 model + 鉴权头）。 */
function passthroughRequest(
  entry: EntryProtocol,
  base: string,
  apiKey: string,
  rawBody: Json,
  modelId: string,
  anthropicVersion: string | null | undefined,
): { url: string; headers: Record<string, string>; body: Json } {
  if (entry === 'anthropic') {
    return {
      url: `${base}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': anthropicVersion ?? '2023-06-01',
      },
      body: { ...rawBody, model: modelId },
    };
  }
  // openai → /chat/completions；responses → /responses，均为 Bearer
  return {
    url: entry === 'responses' ? `${base}/responses` : `${base}/chat/completions`,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: { ...rawBody, model: modelId },
  };
}

/** 原生透传非流式响应的 usage 提取（按入口协议解析）。 */
function passthroughUsageFromJson(entry: EntryProtocol, json: Json): UsageInfo | null {
  if (entry === 'anthropic') return anthropicUsageFromJson(json);
  if (entry === 'responses') return responsesUsageFromJson(json);
  return normalizeOpenAIUsage(json?.usage);
}

/** 原生透传流式响应：在同一读取链路上提取 usage，避免 tee 提前抽干上游。 */
function passthroughUsageStream(
  entry: EntryProtocol,
  stream: ReadableStream<Uint8Array>,
): { stream: ReadableStream<Uint8Array>; usage: Promise<UsageInfo | null> } {
  if (entry === 'anthropic') return observeAnthropicUsageFromSSE(stream);
  if (entry === 'responses') return observeResponsesUsageFromSSE(stream);
  return observeOpenAIUsageFromSSE(stream);
}

/** IR 非流式响应 → 入口协议。 */
function egressJson(entry: EntryProtocol, irJson: Json, requestedModel: string): Json {
  if (entry === 'anthropic') return irResponseToAnthropic(irJson, requestedModel);
  if (entry === 'responses') return irResponseToResponses(irJson, requestedModel);
  return irJson;
}

/** IR SSE → 入口协议 SSE。 */
function egressStream(entry: EntryProtocol, irStream: ReadableStream<Uint8Array>, requestedModel: string): ReadableStream<Uint8Array> {
  if (entry === 'anthropic') return irStreamToAnthropic(irStream, { model: requestedModel });
  if (entry === 'responses') return irStreamToResponses(irStream, { model: requestedModel });
  return irStream;
}

// ---------- 提示词注入（M4，§7.1） ----------

/** 往 OpenAI/IR 消息列表最前面注入 system message；已有首条 system 则拼接在前（空一行）。 */
function injectSystemMessage(body: Json, text: string): void {
  const messages = (body.messages as Json[]) ?? [];
  if (messages.length > 0 && (messages[0].role === 'system' || messages[0].role === 'developer')) {
    const first = messages[0];
    if (typeof first.content === 'string') {
      first.content = text + '\n\n' + first.content;
    } else if (Array.isArray(first.content)) {
      first.content = [{ type: 'text', text: text + '\n\n' }, ...first.content];
    } else {
      first.content = text;
    }
  } else {
    body.messages = [{ role: 'system', content: text }, ...messages];
  }
}

/**
 * 把渲染后的提示词注入请求：
 *  - ir.messages（转换路径用）；
 *  - rawBody（原生透传用）：openai 入口注入 messages，anthropic 入口拼到 system 顶层字段，
 *    responses 入口拼到 instructions 顶层字段。
 */
function injectPrompt(entry: EntryProtocol, rawBody: Json, ir: Json, text: string): void {
  injectSystemMessage(ir, text);
  if (entry === 'openai') {
    if (rawBody !== ir) injectSystemMessage(rawBody, text);
  } else if (entry === 'anthropic') {
    if (typeof rawBody.system === 'string') {
      rawBody.system = text + '\n\n' + rawBody.system;
    } else if (Array.isArray(rawBody.system)) {
      rawBody.system = [{ type: 'text', text: text + '\n\n' }, ...rawBody.system];
    } else {
      rawBody.system = text;
    }
  } else {
    // responses
    rawBody.instructions = rawBody.instructions ? text + '\n\n' + String(rawBody.instructions) : text;
  }
}

interface AttemptContext {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  adapter: ProtocolAdapter | undefined;
  ctx: AdapterContext;
  passthrough: boolean;
}

/** 为某个路由目标构造上游请求（原生透传或适配器转换）。 */
function buildAttempt(entry: EntryProtocol, input: PipelineInput, target: RouteTarget): AttemptContext {
  const provider = target.provider;
  const apiKey = decrypt(provider.apiKeyEnc);
  const base = provider.baseUrl.replace(/\/+$/, '');
  const ctx: AdapterContext = {
    provider,
    apiKey,
    modelId: target.modelId,
    stream: input.stream,
    includeUsage: input.includeUsage,
  };
  const passthrough = provider.protocol === ENTRY_NATIVE_PROTOCOL[entry];
  if (passthrough) {
    const built = passthroughRequest(entry, base, apiKey, input.rawBody, target.modelId, input.anthropicVersion);
    return { ...built, adapter: undefined, ctx, passthrough: true };
  }
  const adapter = getAdapter(provider.protocol);
  if (!adapter) throw protocolNotImplemented(provider.protocol);
  const built = adapter.buildRequest(input.ir, ctx);
  return { url: built.url, headers: built.headers, body: built.body, adapter, ctx, passthrough: false };
}

/**
 * 网关共享管线（§5.1）：模型路由 → 提示词注入 → 按目标顺序尝试（别名 failover）→
 * 转发 → 出口转换 → 日志。
 * failover 规则：仅当请求命中别名且有备选目标、且失败为连接错误/5xx/429（非其它 4xx）、
 * 且尚未向上游建立成功响应时才降级重试；流式响应一旦开始输出即不再 failover。
 * 错误以 GatewayError 抛出，由入口路由按各自协议格式化。所有尝试都写 request_logs。
 */
export async function runGatewayPipeline(input: PipelineInput): Promise<Response> {
  const { entry, rawBody, ir, requestedModel, stream, clientSignal } = input;
  const startedAt = Date.now();
  let logBase = {
    providerId: null as string | null,
    modelId: requestedModel,
    alias: null as string | null,
    promptId: null as string | null,
    tokenId: input.token?.id ?? null,
    tokenName: input.token?.name ?? null,
    tokenPrefix: input.token?.prefix ?? null,
    entryProtocol: entry,
    source: input.source ?? 'unknown',
  };

  const log = (
    base: typeof logBase,
    l: {
      status: number;
      latencyMs: number;
      usage: UsageInfo | null;
      error: string | null;
      firstTokenMs?: number | null;
      durationMs?: number | null;
    },
  ) => {
    writeRequestLog({ ts: startedAt, ...base, stream, ...l });
  };

  try {
    // 1. 模型解析与路由
    const route = resolveModel(requestedModel);
    logBase = { ...logBase, providerId: route.targets[0].provider.id, modelId: route.targets[0].modelId, alias: route.alias };

    // 1.4 令牌限额检查（按 request_logs.cost 聚合；未配单价的调用 cost 为 null 不计入）
    if (input.token) {
      const limit = checkSpendLimit(input.token);
      if (limit.exceeded) {
        throw new GatewayError(
          429,
          `令牌「${input.token.name}」已超出${SPEND_WINDOW_LABELS[limit.window ?? 'total']}限额 $${limit.limit}（已用 $${limit.spent.toFixed(4)}）`,
          'spend_limit_exceeded',
          'rate_limit_error',
        );
      }
    }

    // 1.5 预设提示词注入（M4）：prompt_id 按 id 精确查，prompt_name 按 name 查；
    // 渲染后作为首条 system message 注入 IR 与（透传时）原始请求体。
    if (input.prompt && (input.prompt.id || input.prompt.name)) {
      const ref = input.prompt.id ?? input.prompt.name!;
      const prompt = input.prompt.id ? getPromptById(input.prompt.id) : getPromptByName(input.prompt.name!);
      if (!prompt) {
        throw new GatewayError(404, `提示词 "${ref}" 未找到`, 'prompt_not_found');
      }
      const rendered = renderPrompt(prompt.content, input.prompt.vars);
      injectPrompt(entry, rawBody, ir, rendered.text);
      logBase.promptId = prompt.id;
      if (rendered.missing.length > 0) {
        console.warn(`[gateway] 提示词 "${prompt.name}" 有未替换变量（保留原样）: ${rendered.missing.join(', ')}`);
      }
    }

    // 2. 按目标顺序尝试（别名 failover）
    let failoverFrom: string | null = null;
    for (let i = 0; i < route.targets.length; i++) {
      const target = route.targets[i];
      const isLast = i === route.targets.length - 1;
      const attemptBase = { ...logBase, providerId: target.provider.id, modelId: target.modelId };
      const attempt = buildAttempt(entry, input, target);

      const fetched = await fetchUpstream({
        url: attempt.url,
        headers: attempt.headers,
        body: attempt.body,
        clientSignal,
      });

      if (!fetched.ok) {
        const failNote = `目标 ${target.provider.slug}/${target.modelId} 失败`;
        if (isFailoverable(fetched.status) && !isLast) {
          // 降级到下一目标
          const durationMs = Date.now() - startedAt;
          after(() => log(attemptBase, { status: fetched.status, latencyMs: fetched.latencyMs, durationMs, usage: null, error: `${failNote}（failover 到下一目标）: ${fetched.error}` }));
          failoverFrom = `${target.provider.slug}/${target.modelId}`;
          continue;
        }
        const durationMs = Date.now() - startedAt;
        after(() => log(attemptBase, { status: fetched.status, latencyMs: fetched.latencyMs, durationMs, usage: null, error: failoverFrom ? `${failoverFrom} 失败后降级仍失败: ${fetched.error}` : fetched.error }));
        return fetched.response;
      }

      const { upstream, latencyMs, cleanup } = fetched;
      const successError = failoverFrom ? `failed over from ${failoverFrom}` : null;

      // 非流式
      if (!stream) {
        cleanup();
        const json = await upstream.json();
        let outJson: Json;
        let usage: UsageInfo | null;
        if (attempt.passthrough) {
          outJson = json;
          usage = passthroughUsageFromJson(entry, json);
        } else {
          const irJson = attempt.adapter!.convertResponse(json, attempt.ctx);
          usage = attempt.adapter!.extractUsage(json, attempt.ctx);
          outJson = egressJson(entry, irJson, requestedModel);
        }
        const durationMs = Date.now() - startedAt;
        after(() => log(attemptBase, { status: 200, latencyMs, durationMs, usage, error: successError }));
        return Response.json(outJson, { status: 200 });
      }

      // 流式
      if (!upstream.body) {
        cleanup();
        const durationMs = Date.now() - startedAt;
        after(() => log(attemptBase, { status: 200, latencyMs, durationMs, usage: null, error: '上游流无 body' }));
        return new Response(null, { status: 200, headers: SSE_HEADERS });
      }

      let clientStream: ReadableStream<Uint8Array>;
      let usagePromise: Promise<UsageInfo | null>;
      if (attempt.passthrough) {
        const inspected = passthroughUsageStream(entry, upstream.body);
        clientStream = inspected.stream;
        usagePromise = inspected.usage;
      } else {
        const translated = attempt.adapter!.translateStream(upstream.body, attempt.ctx);
        clientStream = egressStream(entry, translated.stream, requestedModel);
        usagePromise = translated.usage;
      }

      const observed = observeReadableStream(clientStream, startedAt);
      after(async () => {
        try {
          const [usage, timing] = await Promise.all([usagePromise, observed.timing]);
          log(attemptBase, {
            status: 200,
            latencyMs,
            firstTokenMs: timing.firstTokenMs,
            durationMs: timing.durationMs,
            usage,
            error: timing.cancelled ? [successError, '客户端中断流'].filter(Boolean).join('；') : successError,
          });
        } catch (e) {
          log(attemptBase, { status: 200, latencyMs, durationMs: Date.now() - startedAt, usage: null, error: `流中断: ${e instanceof Error ? e.message : String(e)}`.slice(0, 500) });
        } finally {
          cleanup();
        }
      });
      return new Response(observed.stream, { status: 200, headers: SSE_HEADERS });
    }

    // 不可达（循环必然返回），仅作类型兜底
    throw new GatewayError(502, '所有路由目标均失败', 'all_targets_failed', 'server_error');
  } catch (e) {
    const err =
      e instanceof GatewayError
        ? e
        : new GatewayError(500, `网关内部错误: ${e instanceof Error ? e.message : String(e)}`, null, 'server_error');
    const durationMs = Date.now() - startedAt;
    after(() => log(logBase, { status: err.status, latencyMs: durationMs, durationMs, usage: null, error: err.message }));
    throw err;
  }
}
