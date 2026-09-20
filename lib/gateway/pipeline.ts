import { after } from 'next/server';
import { getAdapter } from '@/lib/adapters';
import { decrypt } from '@/lib/crypto';
import { isUpstreamError } from '@/lib/upstream-error';
import { subscriptionStore, subscriptionLifecycle } from '@/lib/subscriptions/runtime';
import { subscriptionWireRequest, normalizeSubscriptionResponse } from '@/lib/subscriptions/gateway';
import type { Credential } from '@/lib/subscriptions/types';
import { subscriptionFetch } from '@/lib/subscriptions/transport';
import { GatewayError, protocolNotImplemented } from './errors';
import { fetchUpstream } from './forward';
import type { FetchFailure } from './forward';
import { writeRequestLog } from './logger';
import { observeReadableStream } from './stream-observer';
import { SSE_HEADERS } from './stream-headers';
import { resolveModel } from './router';
import { extractReasoning, planReasoning } from './reasoning';
import type { RouteTarget } from './router';
import { buildAttemptForEndpoint } from './attempt-builder';
import { selectProviderEndpoint } from './provider-endpoint-selector';
import type { SelectableProviderEndpoint } from './provider-endpoint-selector';
import { runTargetAttempts } from './target-attempt-runner';
import { cancelStreamBestEffort, runStreamSetupSafely } from './stream-setup';
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
import { normalizeOpenAIUsage, type UsageInfo } from '@/lib/services/usage-metrics';
import { sqlite } from '@/lib/db';
import { listProviderEndpointModelObservations, listProviderEndpoints } from '@/lib/services/provider-endpoint';
import { isOfficialBailianCatalogProvider } from '@/lib/vendors/bailian/catalog';
import {
  isBailianAsrModel,
  isBailianTtsModel,
  tryHandleBailianSpecialChat,
} from '@/lib/vendors/bailian/audio';

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
  /** Caller capability flags; only reviewed flags are used for Claude subscriptions. */
  anthropicBeta?: string | null;
  /** 预设提示词注入（§7.1 扩展字段 prompt_id/prompt_name + prompt_vars） */
  prompt?: { id?: string; name?: string; vars?: Record<string, unknown> };
  /** 网关令牌（鉴权已通过）；用于限额检查与日志 token_id */
  token?: TokenRow;
  /** 由入口 User-Agent 归一化出的客户端来源。 */
  source?: string;
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
    providerEndpointId: null as string | null,
    upstreamProtocol: null as string | null,
    source: input.source ?? 'unknown',
  };
  let activeLogBase = logBase;

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
    activeLogBase = logBase;
    // 客户端协议里的思考强度，统一规范化；未携带时不干预，沿用上游默认
    const requestedReasoning = extractReasoning(entry, rawBody);

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

    // 1.8 百炼 DashScope 特殊请求兼容（ASR/TTS 模型由专属客户端与协议处理）
    const firstTarget = route.targets[0];
    if (
      entry === 'openai' &&
      isOfficialBailianCatalogProvider(firstTarget.provider) &&
      (isBailianAsrModel(firstTarget.modelId) || isBailianTtsModel(firstTarget.modelId))
    ) {
      const apiKey = decrypt(firstTarget.provider.apiKeyEnc);
      const specialResult = await tryHandleBailianSpecialChat(
        firstTarget.provider,
        apiKey,
        firstTarget.modelId,
        rawBody,
        clientSignal,
      );
      if (specialResult) {
        // 语音的计量是时长与字符数，不是 token。此前按 duration*10 与 text.length
        // 伪造出 token 数再乘以每百万 token 单价，会在仪表盘上得到一个无法与
        // 官方账单对账的成本；宁可不给，和非美元币种返回 null 是同一条原则。
        // 响应体里也一并省略 usage——OpenAI 各官方 SDK 都按可选字段处理。
        const responseJson = {
          id: `chatcmpl-${crypto.randomUUID()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: requestedModel,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: specialResult.text },
              finish_reason: 'stop',
            },
          ],
        };
        log(logBase, {
          status: 200,
          latencyMs: Date.now() - startedAt,
          usage: null,
          error: null,
        });
        return Response.json(responseJson);
      }
    }

    // 2. 按供应商目标顺序尝试；每个目标只做一次本地端点选择。
    type FailureContext = { attemptBase: typeof logBase; fetched: FetchFailure };
    return await runTargetAttempts<RouteTarget, SelectableProviderEndpoint, Response, FailureContext>({
      targets: route.targets,
      selectEndpoint(target) {
        // Copilot 的 /chat/completions 对 reasoning_effort 支持不可靠：请求带强度时优先已确认支持该模型的 /responses
        const wantsReasoning = !!(requestedReasoning || target.reasoningHint);
        const preferred = wantsReasoning && subscriptionStore.accountForProvider(target.provider.id)?.vendor === 'copilot'
          ? 'openai-responses' as const
          : undefined;
        return selectProviderEndpoint(
          listProviderEndpoints(sqlite, target.provider.id),
          entry,
          target.modelId,
          listProviderEndpointModelObservations(sqlite, target.provider.id),
          preferred,
        );
      },
      onSelected(target, endpoint) {
        activeLogBase = {
          ...logBase,
          providerId: target.provider.id,
          modelId: target.modelId,
          providerEndpointId: endpoint.id,
          upstreamProtocol: endpoint.protocol,
        };
      },
      targetLabel: (target) => `${target.provider.slug}/${target.modelId}`,
      unavailableError: (target) => new GatewayError(
        503,
        `服务商 "${target.provider.slug}" 没有可用的协议端点`,
        'provider_endpoint_unavailable',
        'server_error',
      ),
      onUnavailable(target, willContinue) {
        const unavailableBase = {
          ...logBase,
          providerId: target.provider.id,
          modelId: target.modelId,
          providerEndpointId: null,
          upstreamProtocol: null,
        };
        activeLogBase = unavailableBase;
        if (willContinue) {
          const durationMs = Date.now() - startedAt;
          after(() => log(unavailableBase, {
            status: 503,
            latencyMs: durationMs,
            durationMs,
            usage: null,
            error: `服务商 "${target.provider.slug}" 没有可用的协议端点（failover 到下一目标）`,
          }));
        }
      },
      async execute(target, endpoint, failoverFrom) {
        const attemptBase = {
          ...logBase,
          providerId: target.provider.id,
          modelId: target.modelId,
          providerEndpointId: endpoint.id,
          upstreamProtocol: endpoint.protocol,
        };
        const subscription = subscriptionStore.accountForProvider(target.provider.id);
        const subscriptionFailure = (status: number, message: string) => {
          const response = Response.json({error:{message,type:'upstream_error'}},{status});
          const fetched: FetchFailure = {ok:false,status,response,error:message,latencyMs:Date.now()-startedAt};
          return {ok:false as const,status,value:response,context:{attemptBase,fetched}};
        };
        let credential: Credential | undefined;
        if (subscription) {
          try { credential = await subscriptionLifecycle.credential(subscription.id); }
          catch { return subscriptionFailure(503,'订阅账号暂不可用，请在订阅账号页检查登录状态'); }
        }
        let plan = planReasoning(target.modelId, target.reasoning, requestedReasoning, target.reasoningHint);
        // Copilot chat 只在目录声明了强度档位时才发送 reasoning_effort，否则去掉该字段
        if (subscription?.vendor === 'copilot' && endpoint.protocol === 'openai' && plan.intent && !target.reasoning?.efforts?.length) {
          plan = { ...plan, intent: undefined, rewrite: true };
        }
        const attempt = buildAttemptForEndpoint(
          { ...input, reasoning: plan.intent, reasoningControl: target.reasoning?.control, rewriteReasoning: plan.rewrite },
          { ...target, modelId: plan.upstreamModelId },
          endpoint,
          {
          decrypt: credential ? () => credential!.accessToken : decrypt,
          getAdapter,
          protocolNotImplemented,
        });
        const send = () => {
          const wire = subscription && credential
            ? subscriptionWireRequest(subscription.vendor,credential,attempt,plan.upstreamModelId,stream,input.anthropicBeta)
            : attempt;
          return fetchUpstream({url:wire.url,headers:wire.headers,body:wire.body,clientSignal,redirect:subscription?'error':undefined,discardErrorBody:!!subscription,fetcher:subscription?subscriptionFetch:undefined});
        };
        let fetched = await send();
        if (subscription && credential && !fetched.ok && fetched.status===401) {
          try { credential=await subscriptionLifecycle.credential(subscription.id,credential.accessToken); }
          catch { return subscriptionFailure(503,'订阅账号需要重新授权或凭据刷新暂不可用'); }
          fetched=await send();
        }
        if (!fetched.ok) {
          if (subscription) return subscriptionFailure(fetched.status,`订阅服务返回 HTTP ${fetched.status}，请检查账号状态或稍后重试`);
          return { ok: false as const, status: fetched.status, value: fetched.response, context: { attemptBase, fetched } };
        }

        const { latencyMs, cleanup } = fetched;
        let upstream=fetched.upstream;
        if (subscription) {
          try { upstream=await normalizeSubscriptionResponse(subscription.vendor,upstream,stream,clientSignal); }
          catch(error) { cleanup();await cancelStreamBestEffort(upstream.body,error);return subscriptionFailure(502,'订阅服务未返回有效完整响应'); }
        }
        const successError = failoverFrom ? `failed over from ${failoverFrom}` : null;
        if (!stream) {
          try {
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
            const response = Response.json(outJson, { status: 200 });
            const durationMs = Date.now() - startedAt;
            after(() => log(attemptBase, { status: 200, latencyMs, durationMs, usage, error: successError }));
            return { ok: true as const, value: response };
          } catch (error) {
            await cancelStreamBestEffort(upstream.body, error);
            throw error;
          } finally {
            cleanup();
          }
        }

        if (!upstream.body) {
          cleanup();
          const durationMs = Date.now() - startedAt;
          after(() => log(attemptBase, { status: 200, latencyMs, durationMs, usage: null, error: '上游流无 body' }));
          return { ok: true as const, value: new Response(null, { status: 200, headers: SSE_HEADERS }) };
        }

        const upstreamBody = upstream.body;
        return runStreamSetupSafely(upstreamBody, cleanup, (tracker) => {
          let clientStream: ReadableStream<Uint8Array>;
          let usagePromise: Promise<UsageInfo | null>;
          if (attempt.passthrough) {
            const inspected = passthroughUsageStream(entry, upstreamBody);
            clientStream = inspected.stream;
            tracker.stream(inspected.stream);
            usagePromise = inspected.usage;
          } else {
            const translated = attempt.adapter!.translateStream(upstreamBody, attempt.ctx);
            tracker.stream(translated.stream);
            tracker.usage(translated.usage);
            clientStream = egressStream(entry, translated.stream, requestedModel);
            tracker.stream(clientStream);
            usagePromise = translated.usage;
          }
          tracker.usage(usagePromise);

          const observed = observeReadableStream(clientStream, startedAt);
          tracker.stream(observed.stream);
          const response = new Response(observed.stream, { status: 200, headers: SSE_HEADERS });
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
            } catch (error) {
              log(attemptBase, { status: 200, latencyMs, durationMs: Date.now() - startedAt, usage: null, error: `流中断: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500) });
            } finally {
              cleanup();
            }
          });
          return { ok: true as const, value: response };
        });
      },
      onFailure(target, failure, willContinue, failoverFrom) {
        const { attemptBase, fetched } = failure.context;
        const durationMs = Date.now() - startedAt;
        const failNote = `目标 ${target.provider.slug}/${target.modelId} 失败`;
        const error = willContinue
          ? `${failNote}（failover 到下一目标）: ${fetched.error}`
          : failoverFrom
            ? `${failoverFrom} 失败后降级仍失败: ${fetched.error}`
            : fetched.error;
        after(() => log(attemptBase, {
          status: fetched.status,
          latencyMs: fetched.latencyMs,
          durationMs,
          usage: null,
          error,
        }));
      },
    });
  } catch (e) {
    const err =
      e instanceof GatewayError
        ? e
        : isUpstreamError(e)
          // 上游的非 2xx 不是网关故障，保留它的状态码。
          ? new GatewayError(e.status, e.message, 'upstream_error', e.status >= 500 ? 'api_error' : 'invalid_request_error')
          : new GatewayError(500, `网关内部错误: ${e instanceof Error ? e.message : String(e)}`, null, 'server_error');
    const durationMs = Date.now() - startedAt;
    after(() => log(activeLogBase, { status: err.status, latencyMs: durationMs, durationMs, usage: null, error: err.message }));
    throw err;
  }
}
