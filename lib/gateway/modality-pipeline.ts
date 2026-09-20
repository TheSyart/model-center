import { after } from 'next/server';
import { decrypt } from '@/lib/crypto';
import { GatewayError } from './errors';
import { writeRequestLog } from './logger';
import { resolveModel } from './router';
import type { RouteTarget } from './router';
import { checkSpendLimit, SPEND_WINDOW_LABELS } from '@/lib/services/token';
import type { TokenRow } from '@/lib/services/token';

/**
 * 非对话模态（语音合成、语音识别等）的前置链路。
 *
 * 这些请求不能走 runGatewayPipeline：它的第 2 阶段起全是对话语义
 * （适配器转换、IR、SSE），而端点选择器的 PROTOCOL_ORDER 里也没有 DashScope 这类协议面。
 * 但第 1 阶段是**模态无关**的——解析模型、校验服务商、检查令牌限额、解密凭据、统一记日志——
 * 四条音频路由此前各自手写了一遍，于是各自漏掉了不同的东西。
 *
 * 这里把那段固定下来。进入点与退出点照 pipeline.ts 里已有的百炼 ASR/TTS 分支：
 * 在模型解析之后进入，在端点选择之前退出。
 */

const DEFAULT_TIMEOUT_MS = 120_000;

export interface ModalityAttempt {
  target: RouteTarget;
  /** 已解密的上游凭据。只有 accepts() 放行后才会拿到。 */
  apiKey: string;
  /** 客户端断连或超时都会 abort，调用方必须原样传给 fetch。 */
  signal: AbortSignal;
}

export interface ModalityOutcome {
  /** 直接返回给客户端的响应。 */
  response: Response;
  /** 记进日志的状态码；缺省取 response.status。 */
  status?: number;
  /** 上游错误摘要；成功时留空。 */
  error?: string | null;
}

export interface ModalityRequestOptions {
  /** 记日志用的入口协议，按实际入口填，不要一律写 openai。 */
  entry: 'openai' | 'anthropic' | 'responses';
  requestedModel: string;
  token?: TokenRow;
  source?: string | null;
  clientSignal: AbortSignal;
  /**
   * 允许哪些服务商与模型。**在解密之前判定**——音频客户端把上游主机写死在代码里，
   * 不读 provider.baseUrl，所以放行一个不相干的服务商等于把它的 API Key 发给别人。
   */
  accepts: (target: RouteTarget) => boolean;
  /** 被 accepts 拒绝时给客户端的说明。 */
  rejectMessage: (target: RouteTarget) => string;
  execute: (attempt: ModalityAttempt) => Promise<ModalityOutcome>;
  /** 错误响应的形状：OpenAI 面与 DashScope 原生面不一样。 */
  errorResponse: (status: number, message: string, code: string | null) => Response;
  timeoutMs?: number;
}

export async function runModalityRequest(options: ModalityRequestOptions): Promise<Response> {
  const startedAt = Date.now();
  let logBase = {
    providerId: null as string | null,
    modelId: options.requestedModel,
    alias: null as string | null,
    tokenId: options.token?.id ?? null,
    tokenName: options.token?.name ?? null,
    tokenPrefix: options.token?.prefix ?? null,
    entryProtocol: options.entry,
    upstreamProtocol: null as string | null,
    source: options.source ?? 'unknown',
  };

  const log = (status: number, error: string | null) => {
    const base = logBase;
    const latencyMs = Date.now() - startedAt;
    after(() =>
      writeRequestLog({
        ts: startedAt,
        ...base,
        status,
        latencyMs,
        // 音频计量单位是时长与字符数，不是 token。把它们冒充成 token 再乘以
        // 每百万 token 的单价，会在仪表盘上得到一个无法与官方账单对账的数字；
        // 与 lib/services/pricing.ts 对非美元币种返回 null 是同一条原则。
        usage: null,
        error,
        stream: false,
      }),
    );
  };

  const controller = new AbortController();
  const onClientAbort = () => controller.abort();
  options.clientSignal.addEventListener('abort', onClientAbort);
  if (options.clientSignal.aborted) controller.abort();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    // resolveModel 要么抛 GatewayError(404) 要么返回至少一个目标，没有"返回空数组"这种情况。
    const route = resolveModel(options.requestedModel);
    const target = route.targets[0];
    logBase = {
      ...logBase,
      providerId: target.provider.id,
      modelId: target.modelId,
      alias: route.alias,
      upstreamProtocol: target.provider.protocol,
    };

    if (!options.accepts(target)) {
      throw new GatewayError(400, options.rejectMessage(target), 'model_not_supported');
    }

    if (options.token) {
      const limit = checkSpendLimit(options.token);
      if (limit.exceeded) {
        throw new GatewayError(
          429,
          `令牌「${options.token.name}」已超出${SPEND_WINDOW_LABELS[limit.window ?? 'total']}限额 $${limit.limit}（已用 $${limit.spent.toFixed(4)}）`,
          'spend_limit_exceeded',
          'rate_limit_error',
        );
      }
    }

    const outcome = await options.execute({
      target,
      apiKey: decrypt(target.provider.apiKeyEnc),
      signal: controller.signal,
    });
    const status = outcome.status ?? outcome.response.status;
    log(status, outcome.error ?? null);
    return outcome.response;
  } catch (e) {
    if (e instanceof GatewayError) {
      log(e.status, e.message);
      return options.errorResponse(e.status, e.message, e.code);
    }
    const aborted = controller.signal.aborted;
    const message = aborted
      ? options.clientSignal.aborted
        ? '客户端已断开连接'
        : `上游无响应，已超过 ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms 上限`
      : e instanceof Error
        ? e.message
        : String(e);
    const status = aborted ? 504 : 500;
    log(status, message);
    return options.errorResponse(status, message, aborted ? 'upstream_timeout' : 'internal_error');
  } finally {
    clearTimeout(timeout);
    options.clientSignal.removeEventListener('abort', onClientAbort);
  }
}
