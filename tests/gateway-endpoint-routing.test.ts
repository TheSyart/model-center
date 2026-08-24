import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAttemptForEndpoint } from '../lib/gateway/attempt-builder.ts';

const provider = {
  id: 'provider-a', slug: 'provider-a', name: 'Provider A', protocol: 'openai',
  baseUrl: 'https://legacy.example/v1', apiKeyEnc: 'ciphertext',
};
const target = { provider, modelId: 'model-a' } as any;

const baseInput = {
  entry: 'openai' as const,
  rawBody: { model: 'public-name', messages: [{ role: 'user', content: 'hi' }], extra: true },
  ir: { model: 'public-name', messages: [{ role: 'user', content: 'hi' }] },
  requestedModel: 'public-name', stream: false, includeUsage: false,
};

test('native attempt builds URL, auth headers, rewritten model body, and passthrough from the selected endpoint', () => {
  let adapterLookups = 0;
  const attempt = buildAttemptForEndpoint(baseInput, target, {
    id: 'chat-endpoint', protocol: 'openai', baseUrl: 'https://chat.example/v1/',
  }, {
    decrypt: () => 'upstream-key',
    getAdapter: () => { adapterLookups++; return undefined; },
    protocolNotImplemented: (protocol) => new Error(protocol),
  });

  assert.equal(attempt.url, 'https://chat.example/v1/chat/completions');
  assert.deepEqual(attempt.headers, { 'Content-Type': 'application/json', Authorization: 'Bearer upstream-key' });
  assert.deepEqual(attempt.body, { ...baseInput.rawBody, model: 'model-a' });
  assert.equal(attempt.passthrough, true);
  assert.equal(attempt.adapter, undefined);
  assert.equal(adapterLookups, 0);
});

test('converted attempt uses the selected endpoint provider view and adapter request', () => {
  const adapter = {
    protocol: 'openai-responses',
    buildRequest: (_ir: unknown, ctx: any) => ({
      url: `${ctx.provider.baseUrl}/responses`,
      headers: { Authorization: `Bearer ${ctx.apiKey}`, 'X-Protocol': ctx.provider.protocol },
      body: { model: ctx.modelId, converted: true },
    }),
  } as any;
  const attempt = buildAttemptForEndpoint(baseInput, target, {
    id: 'responses-endpoint', protocol: 'openai-responses', baseUrl: 'https://responses.example/v1',
  }, {
    decrypt: () => 'upstream-key',
    getAdapter: () => adapter,
    protocolNotImplemented: (protocol) => new Error(protocol),
  });

  assert.equal(attempt.url, 'https://responses.example/v1/responses');
  assert.deepEqual(attempt.headers, { Authorization: 'Bearer upstream-key', 'X-Protocol': 'openai-responses' });
  assert.deepEqual(attempt.body, { model: 'model-a', converted: true });
  assert.equal(attempt.passthrough, false);
  assert.equal(attempt.adapter, adapter);
  assert.equal(attempt.ctx.provider.protocol, 'openai-responses');
  assert.equal(attempt.ctx.provider.baseUrl, 'https://responses.example/v1');
});
