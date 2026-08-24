/**
 * 验收用 mock 上游（Anthropic Messages 原生协议）。
 * 用法：node tests/mock-anthropic.mjs [port]（默认 4001）
 * - 校验 max_tokens 必填、打印 x-api-key/anthropic-version 头与 body 结构（system/块类型），便于核对转换；
 * - 含图片块 → 回显收到的块类型摘要；
 * - 带 tools 且用户文本含 "call-tool" → 返回 tool_use（get_weather），流式时发 input_json_delta 分片；
 * - stream: true → Anthropic SSE 事件序列（message_start、content_block_*、message_delta、message_stop）。
 */
import http from 'node:http';

const port = Number(process.argv[2]) || 4001;

function summarize(body) {
  return (body.messages ?? [])
    .map((m) => {
      if (typeof m.content === 'string') return `${m.role}:text`;
      const types = (m.content ?? []).map((b) => b.type).join('+');
      return `${m.role}:[${types}]`;
    })
    .join(' ');
}

function lastUserText(body) {
  const last = [...(body.messages ?? [])].reverse().find((m) => m.role === 'user');
  if (!last) return '';
  if (typeof last.content === 'string') return last.content;
  return (last.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

function wantsTool(body) {
  return Array.isArray(body.tools) && body.tools.length > 0 && lastUserText(body).includes('call-tool');
}

function hasImage(body) {
  return (body.messages ?? []).some(
    (m) => Array.isArray(m.content) && m.content.some((b) => b.type === 'image'),
  );
}

const ev = (event, data) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

function streamEvents(body) {
  const msgStart = ev('message_start', {
    type: 'message_start',
    message: {
      id: 'msg_mock_1', type: 'message', role: 'assistant', content: [], model: body.model,
      stop_reason: null, stop_sequence: null, usage: { input_tokens: 12, output_tokens: 0 },
    },
  });
  if (wantsTool(body)) {
    return [
      msgStart,
      ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 'toolu_mock_1', name: 'get_weather', input: {} } }),
      ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"city"' } }),
      ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: ':"北京"}' } }),
      ev('content_block_stop', { type: 'content_block_stop', index: 0 }),
      ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'tool_use', stop_sequence: null }, usage: { output_tokens: 9 } }),
      ev('message_stop', { type: 'message_stop' }),
    ];
  }
  return [
    msgStart,
    ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }),
    ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '你好，' } }),
    ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: '这是 Anthropic mock 流式响应。' } }),
    ev('content_block_stop', { type: 'content_block_stop', index: 0 }),
    ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 8 } }),
    ev('message_stop', { type: 'message_stop' }),
  ];
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url?.startsWith('/v1/models')) {
    console.log(`[mock-anthropic] GET ${req.url} x-api-key=${req.headers['x-api-key'] ?? '(none)'} anthropic-version=${req.headers['anthropic-version'] ?? '(none)'}`);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        data: [
          { type: 'model', id: 'claude-mock-1', display_name: 'Claude Mock 1' },
          { type: 'model', id: 'claude-mock-2', display_name: 'Claude Mock 2' },
        ],
        has_more: false,
      }),
    );
    return;
  }
  if (req.method !== 'POST' || !req.url?.startsWith('/v1/messages')) {
    res.writeHead(404).end('not found');
    return;
  }
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw || '{}');
    console.log(
      `[mock-anthropic] POST ${req.url} x-api-key=${req.headers['x-api-key'] ?? '(none)'} anthropic-version=${req.headers['anthropic-version'] ?? '(none)'} model=${body.model} stream=${!!body.stream} system=${JSON.stringify(body.system ?? null)} max_tokens=${body.max_tokens} tools=${(body.tools ?? []).length} msgs=${summarize(body)}`,
    );

    if (typeof body.max_tokens !== 'number') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'max_tokens is required' } }));
      return;
    }

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

    let content;
    let stopReason = 'end_turn';
    if (wantsTool(body)) {
      content = [
        { type: 'text', text: '我来查一下天气。' },
        { type: 'tool_use', id: 'toolu_mock_1', name: 'get_weather', input: { city: '北京' } },
      ];
      stopReason = 'tool_use';
    } else if (hasImage(body)) {
      const types = summarize(body);
      content = [{ type: 'text', text: `收到图片，块结构: ${types}` }];
    } else {
      content = [{ type: 'text', text: '这是 Anthropic mock 非流式响应。' }];
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        id: 'msg_mock_1', type: 'message', role: 'assistant', content,
        model: body.model, stop_reason: stopReason, stop_sequence: null,
        usage: { input_tokens: 12, output_tokens: 6 },
      }),
    );
  });
});

server.listen(port, '127.0.0.1', () => console.log(`[mock-anthropic] listening on http://127.0.0.1:${port}`));
