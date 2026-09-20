/**
 * 上游服务商返回的非 2xx。
 *
 * 带上状态码是为了让网关别把它当成自己的故障：客户端把参数写错了，
 * 就该收到 4xx，而不是一个说「网关内部错误」的 500。
 *
 * 放在 lib/ 根而不是 lib/gateway/errors.ts，有两个原因：
 *  1. 方向——厂商模块（lib/vendors）需要抛它，不该为此去依赖 gateway；
 *  2. 语法——errors.ts 用了 TS 参数属性（`constructor(public status: number)`），
 *     而 `npm run test:core` 跑在 node 的 strip-only 模式下，该语法不受支持
 *     （ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX）。这里刻意写成普通字段赋值。
 */
export class UpstreamError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

export function isUpstreamError(value: unknown): value is UpstreamError {
  return value instanceof UpstreamError;
}
