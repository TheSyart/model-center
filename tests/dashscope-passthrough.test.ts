import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DASHSCOPE_PASSTHROUGH_ROUTES,
  extractModel,
  inboundHeaders,
  matchPassthroughRoute,
  outboundHeaders,
  pathIsPassthrough,
  pickDashScopeProvider,
  upstreamHttpUrl,
  upstreamWsUrl,
} from '../lib/passthrough/dashscope.ts';

test('only the nine whitelisted paths pass, everything else under /api/v1 is refused', () => {
  // 需求方逐条提取的清单，漏一条对应功能就坏；多放一条就是把百炼账号变成开放代理。
  assert.equal(DASHSCOPE_PASSTHROUGH_ROUTES.length, 9);

  assert.equal(matchPassthroughRoute('POST', '/api/v1/services/audio/tts/customization')?.method, 'POST');
  assert.equal(matchPassthroughRoute('GET', '/api/v1/uploads')?.method, 'GET');
  assert.equal(matchPassthroughRoute('GET', '/api/v1/tasks/abc-123')?.prefix, '/api/v1/tasks/');
  assert.equal(matchPassthroughRoute('WS', '/api-ws/v1/inference')?.method, 'WS');
  assert.equal(matchPassthroughRoute('WS', '/api-ws/v1/realtime')?.method, 'WS');

  // 前缀匹配只给 tasks/ 这种带 id 的；其余必须整段相等，不能靠前缀混进来。
  assert.equal(matchPassthroughRoute('GET', '/api/v1/tasks/'), null, '没有 task_id 不算');
  assert.equal(matchPassthroughRoute('POST', '/api/v1/services/audio/tts/customization/extra'), null);
  assert.equal(matchPassthroughRoute('POST', '/api/v1/services/aigc/text-generation/generation'), null, '对话不走透传');
  assert.equal(matchPassthroughRoute('GET', '/api/v1/models'), null);
  assert.equal(matchPassthroughRoute('WS', '/api-ws/v1/other'), null);

  // 方法不对：路径在名单上，但该回 405 而不是 404。
  assert.equal(matchPassthroughRoute('GET', '/api/v1/services/audio/tts/customization'), null);
  assert.equal(pathIsPassthrough('/api/v1/services/audio/tts/customization'), true);
  assert.equal(pathIsPassthrough('/api/v1/nope'), false);
  assert.equal(matchPassthroughRoute('post', '/api/v1/uploads'), null, '方法大小写归一但 GET≠POST');
});

test('outbound headers replace auth, inject the workspace, and pass DashScope switches through', () => {
  const out = outboundHeaders(
    {
      host: 'model.shanchen.space',
      authorization: 'Bearer gateway-key',
      'x-api-key': 'gateway-key',
      'x-dashscope-workspace': 'attacker-workspace',
      'content-type': 'application/json',
      'content-length': '123',
      'accept-encoding': 'gzip, br',
      'x-dashscope-async': 'enable',
      'x-dashscope-ossresourceresolve': 'enable',
      'x-dashscope-sse': 'enable',
      cookie: 'session=abc',
      'x-forwarded-for': '1.2.3.4',
      'cf-connecting-ip': '1.2.3.4',
      connection: 'keep-alive',
      'user-agent': 'xiaodan/1.0',
    },
    'sk-bailian',
    'llm-abc',
  );

  // 换 key、注入业务空间——客户端带来的一律不信。
  assert.equal(out.authorization, 'Bearer sk-bailian');
  assert.equal(out['x-dashscope-workspace'], 'llm-abc');
  assert.equal('x-api-key' in out, false);
  // 这三个头改变上游行为，必须到达。
  assert.equal(out['x-dashscope-async'], 'enable');
  assert.equal(out['x-dashscope-ossresourceresolve'], 'enable');
  assert.equal(out['x-dashscope-sse'], 'enable');
  assert.equal(out['content-type'], 'application/json');
  assert.equal(out['user-agent'], 'xiaodan/1.0');
  // hop-by-hop、长度、痕迹全部剥掉。
  for (const gone of ['host', 'content-length', 'cookie', 'x-forwarded-for', 'cf-connecting-ip', 'connection']) {
    assert.equal(gone in out, false, `${gone} 不该出站`);
  }
  // 字节原样、长度可信。
  assert.equal(out['accept-encoding'], 'identity');

  // 服务商没配 workspace 就不发这个头，别发个空串上去。
  assert.equal('x-dashscope-workspace' in outboundHeaders({}, 'k', null), false);
  assert.equal('x-dashscope-workspace' in outboundHeaders({}, 'k', '  '), false);
});

test('outbound headers accept a Headers instance too', () => {
  const h = new Headers({ Authorization: 'Bearer x', 'X-DashScope-Async': 'enable' });
  const out = outboundHeaders(h, 'sk', 'ws');
  assert.equal(out.authorization, 'Bearer sk');
  assert.equal(out['x-dashscope-async'], 'enable');
});

test('inbound headers drop encoding and length, keep request ids, and defeat nginx buffering for SSE', () => {
  const plain = inboundHeaders(
    new Headers({
      'content-type': 'application/json',
      'content-length': '42',
      'content-encoding': 'gzip',
      'x-request-id': 'req-1',
      'set-cookie': 'a=b',
      connection: 'close',
    }),
  );
  assert.equal(plain.get('content-type'), 'application/json');
  assert.equal(plain.get('x-request-id'), 'req-1', '对着百炼工单排查要靠它');
  assert.equal(plain.get('content-length'), null, 'fetch 已解码，上游的长度不再可信');
  assert.equal(plain.get('content-encoding'), null);
  assert.equal(plain.get('set-cookie'), null);
  assert.equal(plain.get('x-accel-buffering'), null, '非流式不用加');

  const sse = inboundHeaders(new Headers({ 'content-type': 'text/event-stream; charset=utf-8' }));
  assert.equal(sse.get('x-accel-buffering'), 'no');
});

test('the provider is the enabled official Bailian row, preferring the exact preset', () => {
  const rows = [
    { slug: 'openai', presetKey: 'openai', enabled: 1, priority: 99, createdAt: 1 },
    { slug: 'bailian-openai', presetKey: 'bailian-openai', enabled: 1, priority: 50, createdAt: 2 },
    { slug: 'bailian', presetKey: 'bailian', enabled: 1, priority: 0, createdAt: 3, workspaceId: 'llm-x' },
    { slug: 'bailian-old', presetKey: 'bailian', enabled: 0, priority: 100, createdAt: 0 },
  ];
  // 官方目录里的 bailian-openai 优先级更高，但 presetKey 精确等于 bailian 的更像「那个百炼」。
  assert.equal(pickDashScopeProvider(rows)?.slug, 'bailian');
  // 禁用的不算，不管 priority 多高。
  assert.equal(pickDashScopeProvider([rows[3]]), null);
  // 完全没有百炼服务商 → null，由调用方回 503。
  assert.equal(pickDashScopeProvider([rows[0]]), null);
  // 同为 presetKey=bailian 时按 priority，再按先建者。
  const two = [
    { slug: 'b1', presetKey: 'bailian', enabled: 1, priority: 1, createdAt: 9 },
    { slug: 'b2', presetKey: 'bailian', enabled: 1, priority: 1, createdAt: 2 },
    { slug: 'b3', presetKey: 'bailian', enabled: 1, priority: 5, createdAt: 8 },
  ];
  assert.equal(pickDashScopeProvider(two)?.slug, 'b3');
  assert.equal(pickDashScopeProvider(two.slice(0, 2))?.slug, 'b2');
});

test('upstream urls keep the path and the query byte for byte on the public host', () => {
  // realtime 协议的 model 就在 query 上，丢了就是「建连成功却不出音」。
  assert.equal(
    upstreamWsUrl('/api-ws/v1/realtime', '?model=qwen3-tts-flash-realtime'),
    'wss://dashscope.aliyuncs.com/api-ws/v1/realtime?model=qwen3-tts-flash-realtime',
  );
  assert.equal(
    upstreamHttpUrl('/api/v1/uploads', '?action=getPolicy&model=qwen-audio-3.0-tts-flash'),
    'https://dashscope.aliyuncs.com/api/v1/uploads?action=getPolicy&model=qwen-audio-3.0-tts-flash',
  );
  assert.equal(upstreamHttpUrl('/api/v1/tasks/abc', ''), 'https://dashscope.aliyuncs.com/api/v1/tasks/abc');
});

test('extractModel reads the model for accounting and never throws', () => {
  const enc = (s: string) => new TextEncoder().encode(s);
  assert.equal(extractModel(enc('{"model":"qwen-audio-3.0-asr-flash","input":{}}'), 'application/json'), 'qwen-audio-3.0-asr-flash');
  assert.equal(extractModel(enc('{"model":"voice-enrollment"}'), 'application/json; charset=utf-8'), 'voice-enrollment');
  // 记账拿不到模型名是小事，绝不能因此影响转发。
  assert.equal(extractModel(enc('{not json'), 'application/json'), null);
  assert.equal(extractModel(enc('{"model":42}'), 'application/json'), null);
  assert.equal(extractModel(enc('{"model":"x"}'), 'text/plain'), null);
  assert.equal(extractModel(null, 'application/json'), null);
  assert.equal(extractModel(new Uint8Array(0), 'application/json'), null);
});
