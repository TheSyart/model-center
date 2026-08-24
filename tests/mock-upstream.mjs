/**
 * 验收用最小 mock 上游（OpenAI 兼容）。
 * 用法：node tests/mock-upstream.mjs [port]（默认 3999）
 * - model == 'fail-model' → 429 OpenAI 错误；
 * - 带 tools 且用户文本含 "call-tool" → 返回 tool_calls（get_weather）；
 * - stream: true → SSE 分 chunk（文本或 tool_calls 增量），末 chunk 带 usage，[DONE] 收尾；
 * - 每个请求在 stdout 打印 method、path、Authorization、model、关键 body 特征。
 */
import http from 'node:http';

const port = Number(process.argv[2]) || 3999;

function wantsTool(body) {
  if (!Array.isArray(body.tools) || body.tools.length === 0) return false;
  const last = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user');
  const text = typeof last?.content === 'string' ? last.content : '';
  return text.includes('call-tool');
}

const TOOL_CALL = {
  id: 'call_mock_weather_1',
  type: 'function',
  function: { name: 'get_weather', arguments: '{"city":"北京"}' },
};
const USAGE = { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 };

function streamChunks(body) {
  const base = { id: 'chatcmpl-mock', object: 'chat.completion.chunk', created: 1787537000, model: body.model };
  const c = (delta, extra = {}) =>
    `data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: extra.finish_reason ?? null }], ...(extra.usage ? { usage: extra.usage } : {}) })}\n\n`;
  if (wantsTool(body)) {
    return [
      c({ role: 'assistant', content: null }),
      c({ tool_calls: [{ index: 0, id: TOOL_CALL.id, type: 'function', function: { name: 'get_weather', arguments: '' } }] }),
      c({ tool_calls: [{ index: 0, function: { arguments: '{"city"' } }] }),
      c({ tool_calls: [{ index: 0, function: { arguments: ':"北京"}' } }] }),
      c({}, { finish_reason: 'tool_calls', usage: USAGE }),
    ];
  }
  return [
    c({ role: 'assistant', content: '' }),
    c({ content: '你好，' }),
    c({ content: '这是 mock 流式响应。' }),
    c({}, { finish_reason: 'stop', usage: USAGE }),
  ];
}

const server = http.createServer((req, res) => {
  // GET 端点：模型列表与余额（M5 验收）
  if (req.method === 'GET') {
    if (req.url?.endsWith('/models')) {
      console.log(`[mock-openai] GET ${req.url} auth=${req.headers.authorization ?? '(none)'}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', data: [{ id: 'mock-chat', object: 'model' }, { id: 'mock-pro', object: 'model' }] }));
      return;
    }
    if (req.url?.endsWith('/user/balance')) {
      console.log(`[mock-openai] GET ${req.url} auth=${req.headers.authorization ?? '(none)'}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          is_available: true,
          balance_infos: [{ currency: 'CNY', total_balance: '50.00', granted_balance: '10.00', topped_up_balance: '40.00' }],
        }),
      );
      return;
    }
    if (req.url?.endsWith('/custom/balance')) {
      console.log(`[mock-openai] GET ${req.url} auth=${req.headers.authorization ?? '(none)'}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 0, data: { balance_infos: [{ total_balance: '66.50' }] } }));
      return;
    }
    res.writeHead(404).end('not found');
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405).end('method not allowed');
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    const roles = (body.messages ?? []).map((m) => m.role).join(',');
    const firstSystem = (body.messages ?? []).find((m) => m.role === 'system');
    const sysText = typeof firstSystem?.content === 'string' ? firstSystem.content.slice(0, 80) : '(none)';
    console.log(`[mock-openai] POST ${req.url} auth=${req.headers.authorization ?? '(none)'} model=${body.model} stream=${!!body.stream} tools=${(body.tools ?? []).length} roles=[${roles}] system="${sysText}"`);

    if (body.model === 'fail-model') {
      res.writeHead(429, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'rate limit exceeded (mock)', type: 'rate_limit_error', code: 'rate_limited' } }));
      return;
    }
    if (body.model === 'fail500') {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'internal error (mock)', type: 'server_error' } }));
      return;
    }

    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const pieces = streamChunks(body);
      let i = 0;
      const timer = setInterval(() => {
        if (i < pieces.length) {
          res.write(pieces[i++]);
        } else {
          clearInterval(timer);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      }, 60);
      res.on('close', () => clearInterval(timer));
      return;
    }

    const tool = wantsTool(body);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'chatcmpl-mock',
        object: 'chat.completion',
        created: 1787537000,
        model: body.model,
        choices: [
          tool
            ? { index: 0, message: { role: 'assistant', content: null, tool_calls: [TOOL_CALL] }, finish_reason: 'tool_calls' }
            : { index: 0, message: { role: 'assistant', content: '这是 mock 非流式响应。' }, finish_reason: 'stop' },
        ],
        usage: USAGE,
      }),
    );
  });
});

server.listen(port, '127.0.0.1', () => console.log(`[mock-openai] listening on http://127.0.0.1:${port}`));
