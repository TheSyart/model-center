import test from 'node:test';
import assert from 'node:assert/strict';
import {
  subscriptionWireRequest,
  normalizeSubscriptionResponse,
} from '../lib/subscriptions/gateway.ts';
import type { Credential } from '../lib/subscriptions/types.ts';
const credential: Credential = {
  accessToken: 'oauth-token',
  refreshToken: 'private-refresh',
  accountKey: 'account-a',
  email: null,
  expiresAt: 999999,
  projectId: 'project-a',
};
const request = {
  url: 'https://wrong.example',
  headers: { 'x-api-key': 'old', 'Content-Type': 'application/json' },
  body: {
    model: 'model-a',
    messages: [{ role: 'user', content: 'hello' }],
    tools: [{ name: 'read', input_schema: { type: 'object' } }],
  },
};
function sse(events: unknown[]) {
  return new Response(
    events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join(''),
    { headers: { 'content-type': 'text/event-stream' } }
  );
}
test('Claude uses fixed official target, OAuth Bearer and preserves tools without mutating input', () => {
  const result = subscriptionWireRequest(
    'claude',
    credential,
    request,
    'model-a',
    false
  );
  assert.equal(result.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(result.headers.Authorization, 'Bearer oauth-token');
  assert.equal(result.headers['x-api-key'], undefined);
  assert.match(result.headers['anthropic-beta'], /oauth/);
  assert.deepEqual((result.body as any).tools, request.body.tools);
  assert.equal(request.headers['x-api-key'], 'old');
  assert.ok(!JSON.stringify(result).includes('private-refresh'));
});
test('Codex forces upstream SSE, disables storage and sends workspace account header', () => {
  const result = subscriptionWireRequest(
    'codex',
    credential,
    {
      ...request,
      body: {
        input: [],
        stream: false,
        max_output_tokens: 42,
        previous_response_id: 'old',
      },
    },
    'model-a',
    false
  );
  assert.equal(result.url, 'https://chatgpt.com/backend-api/codex/responses');
  assert.equal(result.headers['ChatGPT-Account-Id'], 'account-a');
  assert.equal((result.body as any).stream, true);
  assert.equal((result.body as any).store, false);
  assert.equal((result.body as any).max_output_tokens, undefined);
  assert.equal((result.body as any).previous_response_id, undefined);
});
test('Gemini wraps the request with account project and model', () => {
  const result = subscriptionWireRequest(
    'gemini',
    credential,
    {
      ...request,
      body: { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] },
    },
    'gemini-model',
    true
  );
  assert.equal(
    result.url,
    'https://cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse'
  );
  assert.equal((result.body as any).project, 'project-a');
  assert.equal((result.body as any).model, 'gemini-model');
  assert.deepEqual((result.body as any).request.contents, [
    { role: 'user', parts: [{ text: 'hi' }] },
  ]);
  assert.equal(result.headers['x-goog-api-key'], undefined);
  assert.throws(
    () =>
      subscriptionWireRequest(
        'gemini',
        { ...credential, projectId: null },
        request,
        'x',
        false
      ),
    /项目/
  );
});
test('Antigravity supplies the validated bypass for tool history without replay metadata', () => {
  const body = {
    contents: [
      {
        role: 'model',
        parts: [{ functionCall: { name: 'echo', args: { text: 'hello' } } }],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: { name: 'echo', response: { result: 'hello' } },
          },
        ],
      },
    ],
  };
  const result = subscriptionWireRequest(
    'antigravity',
    credential,
    { ...request, body },
    'gemini-3.8-flash-tiered',
    true
  );
  assert.equal(
    (result.body as any).request.contents[0].parts[0].thoughtSignature,
    'skip_thought_signature_validator'
  );
  assert.equal((body.contents[0].parts[0] as any).thoughtSignature, undefined, 'the caller request remains unchanged');
});
test('Codex non-stream clients receive terminal response including tool outputs and usage', async () => {
  const item = {
    type: 'function_call',
    id: 'fc',
    call_id: 'call-1',
    name: 'read',
    arguments: '{}',
  };
  const response = await normalizeSubscriptionResponse(
    'codex',
    sse([
      { type: 'response.output_item.done', output_index: 0, item },
      {
        type: 'response.completed',
        response: {
          id: 'r1',
          status: 'completed',
          usage: { input_tokens: 12, output_tokens: 3 },
        },
      },
    ]),
    false
  );
  const body = await response.json();
  assert.deepEqual(body.output, [item]);
  assert.equal(body.usage.input_tokens, 12);
});
test('Codex truncated or failed streams are errors, not fabricated success', async () => {
  await assert.rejects(
    normalizeSubscriptionResponse(
      'codex',
      sse([{ type: 'response.created', response: { id: 'partial' } }]),
      false
    ),
    /完整/
  );
  await assert.rejects(
    normalizeSubscriptionResponse(
      'codex',
      sse([
        {
          type: 'response.failed',
          response: { error: { message: 'sensitive' } },
        },
      ]),
      false
    ),
    /失败/
  );
});
test('Gemini envelopes are removed for both JSON and SSE with split CRLF events', async () => {
  const native = {
    candidates: [{ content: { parts: [{ text: 'hello' }] } }],
    usageMetadata: { promptTokenCount: 4 },
  };
  assert.deepEqual(
    await (
      await normalizeSubscriptionResponse(
        'gemini',
        Response.json({ response: native }),
        false
      )
    ).json(),
    native
  );
  const bytes = new TextEncoder().encode(
    `data: ${JSON.stringify({ response: native })}\r\n\r\n`
  );
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(c) {
      if (index >= bytes.length) c.close();
      else c.enqueue(bytes.slice(index, (index += 3)));
    },
  });
  const out = await normalizeSubscriptionResponse(
    'gemini',
    new Response(stream),
    true
  );
  const text = await out.text();
  assert.ok(text.includes('hello'));
  assert.ok(!text.includes('"response"'));
  assert.ok(text.includes('usageMetadata'));
});
test('cancelling normalized Gemini stream cancels upstream reader', async () => {
  let cancelled = false;
  const source = new ReadableStream<Uint8Array>({
    pull(c) {
      c.enqueue(
        new TextEncoder().encode('data: {"response":{"candidates":[]}}\n\n')
      );
    },
    cancel() {
      cancelled = true;
    },
  });
  const response = await normalizeSubscriptionResponse(
    'gemini',
    new Response(source),
    true
  );
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(cancelled, true);
});
test('Claude known caller capability betas survive OAuth wrapping without copying untrusted headers', () => {
  const wire = subscriptionWireRequest(
    'claude',
    credential,
    {
      ...request,
      headers: {
        'Anthropic-Beta':
          'context-1m-2025-08-07, advanced-tool-use-2025-11-20,unknown-beta-2099-01-01',
        Authorization: 'untrusted',
      },
    },
    'claude-model',
    true
  );
  const betas = wire.headers['anthropic-beta'].split(',');
  assert.ok(betas.includes('claude-code-20250219'));
  assert.ok(betas.includes('oauth-2025-04-20'));
  assert.ok(betas.includes('context-1m-2025-08-07'));
  assert.ok(betas.includes('advanced-tool-use-2025-11-20'));
  assert.ok(!betas.includes('unknown-beta-2099-01-01'));
  assert.equal(wire.headers.Authorization, 'Bearer oauth-token');
});
test('Claude body capabilities enable matching supported betas, and thinking display disables redaction', () => {
  const wire = subscriptionWireRequest(
    'claude',
    credential,
    {
      ...request,
      headers: { 'anthropic-beta': 'redact-thinking-2026-02-12' },
      body: {
        tools: [{ type: 'tool_search_tool_regex_20251119', name: 'search' }],
        context_management: { edits: [] },
        output_config: { format: { type: 'json_schema' } },
        speed: 'fast',
        thinking: { type: 'adaptive', display: 'summarized' },
      },
    },
    'claude-model',
    false
  );
  const betas = wire.headers['anthropic-beta'].split(',');
  for (const beta of [
    'advanced-tool-use-2025-11-20',
    'context-management-2025-06-27',
    'structured-outputs-2025-12-15',
    'fast-mode-2026-02-01',
  ])
    assert.ok(betas.includes(beta));
  assert.ok(!betas.includes('redact-thinking-2026-02-12'));
});
test('Copilot follows the selected endpoint protocol and seat host with editor identity headers', () => {
  const seat = { ...credential, apiBase: 'https://api.business.githubcopilot.com' };
  const chat = subscriptionWireRequest(
    'copilot',
    seat,
    { ...request, endpoint: { protocol: 'openai' } },
    'gpt-5.1',
    true
  );
  assert.equal(chat.url, 'https://api.business.githubcopilot.com/chat/completions');
  assert.equal(chat.headers.Authorization, 'Bearer oauth-token');
  assert.equal(chat.headers['Copilot-Integration-Id'], 'vscode-chat');
  assert.equal(chat.headers['X-GitHub-Api-Version'], '2025-10-01');
  assert.equal(chat.headers['X-Initiator'], 'user');
  assert.equal(chat.headers['x-api-key'], undefined);
  assert.equal((chat.body as any).stream, true);
  const responses = subscriptionWireRequest(
    'copilot',
    seat,
    {
      url: 'https://wrong.example',
      headers: {},
      body: { input: [{ type: 'function_call_output', call_id: 'c', output: 'ok' }] },
      endpoint: { protocol: 'openai-responses' },
    },
    'gpt-5.1-codex',
    false
  );
  assert.equal(responses.url, 'https://api.business.githubcopilot.com/responses');
  assert.equal(responses.headers['X-Initiator'], 'agent');
  assert.equal((responses.body as any).model, 'gpt-5.1-codex');
  const tool = subscriptionWireRequest(
    'copilot',
    { ...credential, apiBase: 'https://evil.example' },
    {
      ...request,
      body: {
        messages: [
          { role: 'user', content: 'x' },
          { role: 'tool', tool_call_id: 't', content: 'result' },
        ],
      },
    },
    'gpt-5.1',
    false
  );
  assert.equal(tool.url, 'https://api.githubcopilot.com/chat/completions');
  assert.equal(tool.headers['X-Initiator'], 'agent');
});
test('Codex listing and inference share one client version', () => {
  const wire = subscriptionWireRequest('codex', credential, { ...request, body: { input: [] } }, 'gpt-5.5', true);
  assert.equal(wire.headers.version, '0.154.0');
  assert.equal(wire.headers['User-Agent'], 'codex_cli_rs/0.154.0');
});
