import assert from 'node:assert/strict';
import test from 'node:test';

import { isNativeEndpoint, providerForEndpoint, shouldFailoverStatus } from '../lib/gateway/endpoint-attempt-context.ts';

test('gateway attempt uses the selected endpoint protocol and base URL rather than legacy provider projection', () => {
  const selected = providerForEndpoint(
    { protocol: 'openai', baseUrl: 'https://chat.example/v1' },
    { id: 'endpoint-responses', protocol: 'openai-responses', baseUrl: 'https://responses.example/v1' },
  );
  assert.equal(selected.protocol, 'openai-responses');
  assert.equal(selected.baseUrl, 'https://responses.example/v1');
  assert.equal(isNativeEndpoint('openai', selected.protocol), false);
});

test('ordinary upstream 400 and 404 statuses never trigger endpoint failover', () => {
  assert.equal(shouldFailoverStatus(400), false);
  assert.equal(shouldFailoverStatus(404), false);
  assert.equal(shouldFailoverStatus(429), true);
});
