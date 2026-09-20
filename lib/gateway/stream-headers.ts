/**
 * 流式响应的响应头。
 *
 * 两条都不是可选的：
 *
 *  - **绝不写 Content-Length。** 流式下长度事先不知道；写死一个值，客户端读满
 *    那么多字节就不读了，音频从中间截断。
 *  - **要写 X-Accel-Buffering: no。** nginx 默认 `proxy_buffering on`，会把整段
 *    响应攒完再下发——首包延迟等于全程合成时间，流式就完全白做了。本项目部署在
 *    服务器上、前面大概率有反向代理，所以这一条是必须的。
 *
 * 两条不该写的：`Connection` 是 hop-by-hop 头，在 HTTP/2 下非法；
 * `Transfer-Encoding` 由 Node 自己决定，手写会打架。
 *
 * 零 import：要能被 `npm run test:core` 的 strip-only 模式直接引用。
 */

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  'X-Accel-Buffering': 'no',
} as const;

export function audioStreamHeaders(contentType: string): Record<string, string> {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store',
    'X-Accel-Buffering': 'no',
  };
}
