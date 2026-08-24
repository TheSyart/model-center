import type { NextRequest } from 'next/server';
import { authenticateToken } from '@/lib/services/token';
import type { TokenAuthResult } from '@/lib/services/token';

/** 网关鉴权：Authorization: Bearer <token> 或 x-api-key（Anthropic 出口兼容 Claude Code）。 */
export function checkGatewayAuth(req: NextRequest): TokenAuthResult {
  const header = req.headers.get('authorization') ?? '';
  let token = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
  // Anthropic 出口兼容 x-api-key
  if (!token) token = (req.headers.get('x-api-key') ?? '').trim();
  if (!token) {
    return { ok: false, code: 'invalid_api_key', message: '无效或缺失的网关令牌（Authorization: Bearer <token>）' };
  }
  return authenticateToken(token);
}
