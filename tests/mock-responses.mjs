/**
 * 验收用 mock 上游（OpenAI Responses API 原生协议）。
 * 用法：node tests/mock-responses.mjs [port]（默认 4003）
 * - POST /responses：打印 Authorization、instructions、input item 类型、tools、metadata（验证透传保留未知字段）；
 * - 带 tools 且 input 文本含 "call-tool" → 返回 function_call output item；
 * - stream: true → Responses SSE 事件序列（response.created/in_progress/output_item.added/
 *   content_part.added/output_text.delta/.../response.completed），工具场景为
 *   function_call_arguments.delta 分片。
 */
import http from 'node:http';

const port = Number(process.argv[2]) || 4003;

function lastText(body) {
  const items = Array.isArray(body.input) ? body.input : [];
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    if (typeof it === 'string') return it;
    if (it?.type === 'message' || it?.role) {
      const content = it.content;
      if (typeof content === 'string') return content;
      return (content ?? []).filter((p) => p.type === 'input_text' || p.type === 'output_text').map((p) => p.text).join('');
    }
  }
  return typeof body.input === 'string' ? body.input : '';
}

function wantsTool(body) {
  return Array.isArray(body.tools) && body.tools.length > 0 && lastText(body).includes('call-tool');
}

function inputSummary(body) {
  if (typeof body.input === 'string') return 'string';
  return (body.input ?? [])
    .map((it) => (typeof it === 'string' ? 'string' : it.type ?? it.role ?? '?'))
    .join(',');
}

const ev = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const USAGE = { input_tokens: 13, output_tokens: 5, total_tokens: 18 };

function finalResponse(body, tool) {
  return {
    id: 'resp_mock_1', object: 'response', created_at: 1787539000, status: 'completed',
    incomplete_details: null, model: body.model,
    output: tool
      ? [{ type: 'function_call', id: 'fc_mock_1', call_id: 'call_mock_resp_1', name: 'get_weather', arguments: '{"city":"北京"}', status: 'completed' }]
      : [{ type: 'message', id: 'msg_mock_1', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '这是 Responses mock 响应。', annotations: [] }] }],
    usage: USAGE,
  };
}

function streamEvents(body) {
  const base = { id: 'resp_mock_1', object: 'response', created_at: 1787539000, status: 'in_progress', model: body.model, output: [] };
  const head = [
    ev('response.created', { type: 'response.created', response: base }),
    ev('response.in_progress', { type: 'response.in_progress', response: base }),
  ];
  if (wantsTool(body)) {
    return [
      ...head,
      ev('response.output_item.added', { type: 'response.output_item.added', output_index: 0, item: { type: 'function_call', id: 'fc_mock_1', call_id: 'call_mock_resp_1', name: 'get_weather', arguments: '', status: 'in_progress' } }),
      ev('response.function_call_arguments.delta', { type: 'response.function_call_arguments.delta', item_id: 'fc_mock_1', output_index: 0, delta: '{"city"' }),
      ev('response.function_call_arguments.delta', { type: 'response.function_call_arguments.delta', item_id: 'fc_mock_1', output_index: 0, delta: ':"北京"}' }),
      ev('response.output_item.done', { type: 'response.output_item.done', output_index: 0, item: { type: 'function_call', id: 'fc_mock_1', call_id: 'call_mock_resp_1', name: 'get_weather', arguments: '{"city":"北京"}', status: 'completed' } }),
      ev('response.completed', { type: 'response.completed', response: finalResponse(body, true) }),
    ];
  }
  return [
    ...head,
    ev('response.output_item.added', { type: 'response.output_item.added', output_index: 0, item: { type: 'message', id: 'msg_mock_1', status: 'in_progress', role: 'assistant', content: [] } }),
    ev('response.content_part.added', { type: 'response.content_part.added', item_id: 'msg_mock_1', output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } }),
    ev('response.output_text.delta', { type: 'response.output_text.delta', item_id: 'msg_mock_1', output_index: 0, content_index: 0, delta: '你好，' }),
    ev('response.output_text.delta', { type: 'response.output_text.delta', item_id: 'msg_mock_1', output_index: 0, content_index: 0, delta: '这是 Responses mock 流式响应。' }),
    ev('response.content_part.done', { type: 'response.content_part.done', item_id: 'msg_mock_1', output_index: 0, content_index: 0, part: { type: 'output_text', text: '你好，这是 Responses mock 流式响应。', annotations: [] } }),
    ev('response.output_item.done', { type: 'response.output_item.done', output_index: 0, item: { type: 'message', id: 'msg_mock_1', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: '你好，这是 Responses mock 流式响应。', annotations: [] }] } }),
    ev('response.completed', { type: 'response.completed', response: finalResponse(body, false) }),
  ];
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/models') {
    console.log(`[mock-responses] GET /models auth=${req.headers.authorization ?? '(none)'}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ object: 'list', data: [{ id: 'gpt-mock-1', object: 'model' }, { id: 'gpt-mock-2', object: 'model' }] }));
    return;
  }
  if (req.method !== 'POST' || req.url !== '/responses') {
    res.writeHead(404).end('not found');
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    console.log(
      `[mock-responses] POST /responses auth=${req.headers.authorization ?? '(none)'} model=${body.model} stream=${!!body.stream} instructions=${JSON.stringify(body.instructions ?? null)} input=[${inputSummary(body)}] tools=${(body.tools ?? []).length} metadata=${JSON.stringify(body.metadata ?? null)} max_output_tokens=${body.max_output_tokens ?? '(none)'}`,
    );

    if (body.stream) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
      const events = streamEvents(body);
      let i = 0;
      const timer = setInterval(() => {
        if (i < events.length) res.write(events[i++]);
        else {
          clearInterval(timer);
          res.end();
        }
      }, 60);
      res.on('close', () => clearInterval(timer));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(finalResponse(body, wantsTool(body))));
  });
});

server.listen(port, '127.0.0.1', () => console.log(`[mock-responses] listening on http://127.0.0.1:${port}`));
