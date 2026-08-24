/**
 * 验收用 mock 上游（Gemini 原生 generateContent 协议）。
 * 用法：node tests/mock-gemini.mjs [port]（默认 4002）
 * - 路径 /v1beta/models/{model}:generateContent 与 :streamGenerateContent?alt=sse；
 * - 打印 x-goog-api-key 头、systemInstruction、contents 角色与 parts 类型，便于核对转换；
 * - 带 tools 且用户文本含 "call-tool" → 返回 functionCall（get_weather）；
 * - 流式：SSE 增量 text parts / functionCall，末 chunk 带 finishReason + usageMetadata。
 */
import http from 'node:http';

const port = Number(process.argv[2]) || 4002;

function summarize(body) {
  return (body.contents ?? [])
    .map((c) => `${c.role}:[${(c.parts ?? []).map((p) => Object.keys(p)[0]).join('+')}]`)
    .join(' ');
}

function lastUserText(body) {
  const last = [...(body.contents ?? [])].reverse().find((c) => c.role === 'user');
  return (last?.parts ?? []).filter((p) => typeof p.text === 'string').map((p) => p.text).join('');
}

function wantsTool(body) {
  return Array.isArray(body.tools) && body.tools.length > 0 && lastUserText(body).includes('call-tool');
}

function hasInlineImage(body) {
  return (body.contents ?? []).some((c) => (c.parts ?? []).some((p) => p.inlineData || p.fileData));
}

const USAGE_META = { promptTokenCount: 5, candidatesTokenCount: 4, totalTokenCount: 9 };

function buildResponse(body, text) {
  const tool = wantsTool(body);
  return {
    candidates: [
      {
        content: {
          role: 'model',
          parts: tool ? [{ functionCall: { name: 'get_weather', args: { city: '北京' } } }] : [{ text }],
        },
        finishReason: 'STOP',
      },
    ],
    usageMetadata: USAGE_META,
  };
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url?.startsWith('/v1beta/models')) {
    console.log(`[mock-gemini] GET ${req.url} x-goog-api-key=${req.headers['x-goog-api-key'] ?? '(none)'}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        models: [
          { name: 'models/gemini-mock-1', displayName: 'Gemini Mock 1' },
          { name: 'models/gemini-mock-2', displayName: 'Gemini Mock 2' },
        ],
      }),
    );
    return;
  }
  const m = /^\/v1beta\/models\/(.+?):(generateContent|streamGenerateContent)(\?.*)?$/.exec(req.url ?? '');
  if (req.method !== 'POST' || !m) {
    res.writeHead(404).end('not found');
    return;
  }
  const model = decodeURIComponent(m[1]);
  const isStream = m[2] === 'streamGenerateContent';
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    console.log(
      `[mock-gemini] POST ${req.url} x-goog-api-key=${req.headers['x-goog-api-key'] ?? '(none)'} model=${model} stream=${isStream} sys=${JSON.stringify(body.systemInstruction ?? null)} tools=${(body.tools ?? []).length} contents=${summarize(body)}`,
    );

    const text = hasInlineImage(body)
      ? `收到图片，块结构: ${summarize(body)}`
      : '这是 Gemini mock 响应。';

    if (isStream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const tool = wantsTool(body);
      const chunk = (parts, extra = {}) =>
        `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts }, ...(extra.finishReason ? { finishReason: extra.finishReason } : {}) }], ...(extra.usage ? { usageMetadata: extra.usage } : {}) })}\n\n`;
      const pieces = tool
        ? [chunk([{ functionCall: { name: 'get_weather', args: { city: '北京' } } }], { finishReason: 'STOP', usage: USAGE_META })]
        : [
            chunk([{ text: '你好，' }]),
            chunk([{ text }]),
            chunk([{ text: '' }], { finishReason: 'STOP', usage: USAGE_META }),
          ];
      let i = 0;
      const timer = setInterval(() => {
        if (i < pieces.length) res.write(pieces[i++]);
        else {
          clearInterval(timer);
          res.end();
        }
      }, 60);
      res.on('close', () => clearInterval(timer));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(buildResponse(body, text)));
  });
});

server.listen(port, '127.0.0.1', () => console.log(`[mock-gemini] listening on http://127.0.0.1:${port}`));
