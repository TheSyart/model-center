import { writeRequestLog } from '@/lib/gateway/logger';
import { createDashScopeUpgradeHandler, type UpgradeHandler } from '@/lib/passthrough/ws-bridge';
import { pickDashScopeProvider } from '@/lib/passthrough/dashscope';
import { listProviders, readProviderApiKey } from '@/lib/services/provider';
import { authenticateToken, checkSpendLimit, getToken, SPEND_WINDOW_LABELS } from '@/lib/services/token';
import { normalizeRequestSource } from '@/lib/services/usage-metrics';

/**
 * 桥接的生产装配：把鉴权、选服务商、解密、记账接到 ws-bridge 的注入点上。
 *
 * 这些依赖全是 `@/` 别名 import，所以只能在 Next 打包的范围内出现——
 * ws-bridge.ts 自己保持零别名，好让 node:test 直接跑它。
 */
export function createProductionUpgradeHandler(): UpgradeHandler {
  return createDashScopeUpgradeHandler({
    authenticate: (bearer) => {
      if (!bearer) {
        return { ok: false, code: 'invalid_api_key', message: '无效或缺失的网关令牌（Authorization: Bearer <token>）' };
      }
      const result = authenticateToken(bearer);
      return result.ok
        ? { ok: true, token: { id: result.token.id, name: result.token.name, prefix: result.token.prefix } }
        : result;
    },
    spendLimit: (token) => {
      const row = getToken(token.id);
      if (!row) return { exceeded: false };
      const limit = checkSpendLimit(row);
      if (!limit.exceeded) return { exceeded: false };
      return {
        exceeded: true,
        message: `令牌「${row.name}」已超出${SPEND_WINDOW_LABELS[limit.window ?? 'total']}限额 $${limit.limit}（已用 $${limit.spent.toFixed(4)}）`,
      };
    },
    pickProvider: () => {
      const provider = pickDashScopeProvider(listProviders());
      if (!provider) return null;
      return { id: provider.id, apiKey: readProviderApiKey(provider), workspaceId: provider.workspaceId };
    },
    log: (f) =>
      writeRequestLog({
        ts: f.ts,
        providerId: f.providerId,
        modelId: f.modelId,
        alias: null,
        tokenId: f.token.id,
        tokenName: f.token.name,
        tokenPrefix: f.token.prefix,
        entryProtocol: 'dashscope',
        upstreamProtocol: 'dashscope-ws',
        source: normalizeRequestSource(f.source),
        status: f.status,
        latencyMs: f.latencyMs,
        firstTokenMs: f.firstTokenMs,
        durationMs: f.durationMs,
        // 语音按时长/字符计价，透传更拿不到统一口径；不编一个。
        usage: null,
        error: f.error,
        stream: true,
      }),
  });
}
