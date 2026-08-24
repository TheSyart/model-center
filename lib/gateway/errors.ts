import { NextResponse } from 'next/server';

/** 网关内部错误：携带 HTTP 状态码与 OpenAI 风格错误信息。 */
export class GatewayError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string | null = null,
    public type: string = 'invalid_request_error',
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

/** OpenAI 风格错误响应：{ error: { message, type, param, code } } */
export function openaiErrorResponse(
  status: number,
  message: string,
  opts: { type?: string; code?: string | null; param?: string | null } = {},
): NextResponse {
  return NextResponse.json(
    {
      error: {
        message,
        type: opts.type ?? 'invalid_request_error',
        param: opts.param ?? null,
        code: opts.code ?? null,
      },
    },
    { status },
  );
}

export function gatewayErrorToResponse(e: GatewayError): NextResponse {
  return openaiErrorResponse(e.status, e.message, { type: e.type, code: e.code });
}

/** 未实现协议的 501（如 openai-responses 适配器待 M3b 实现）。 */
export function protocolNotImplemented(protocol: string): GatewayError {
  return new GatewayError(501, `协议 "${protocol}" 的适配器尚未实现`, 'adapter_not_implemented', 'server_error');
}

/** HTTP 状态码 → Anthropic 错误 type（/v1/messages 出口用）。 */
export function anthropicErrorType(status: number): string {
  switch (status) {
    case 400:
      return 'invalid_request_error';
    case 401:
      return 'authentication_error';
    case 403:
      return 'permission_error';
    case 404:
      return 'not_found_error';
    case 429:
      return 'rate_limit_error';
    case 529:
      return 'overloaded_error';
    default:
      return 'api_error';
  }
}

/** Anthropic 风格错误响应：{ type: 'error', error: { type, message } } */
export function anthropicErrorResponse(status: number, message: string): NextResponse {
  return NextResponse.json(
    { type: 'error', error: { type: anthropicErrorType(status), message } },
    { status },
  );
}
