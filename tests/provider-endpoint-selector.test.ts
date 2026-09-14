import assert from 'node:assert/strict';
import test from 'node:test';

import { selectProviderEndpoint } from '../lib/gateway/provider-endpoint-selector.ts';

type Endpoint = Parameters<typeof selectProviderEndpoint>[0][number];

function endpoint(overrides: Partial<Endpoint> & Pick<Endpoint, 'id' | 'protocol'>): Endpoint {
  return {
    baseUrl: `https://${overrides.id}.example`,
    enabled: true,
    isDefault: false,
    modelCatalogComplete: false,
    ...overrides,
  };
}

test('selects the enabled native endpoint when its model catalog is unknown', () => {
  const chosen = selectProviderEndpoint([
    endpoint({ id: 'chat', protocol: 'openai' }),
    endpoint({ id: 'responses', protocol: 'openai-responses', isDefault: true }),
  ], 'openai', 'unlisted-model', []);

  assert.equal(chosen?.id, 'chat');
});

test('skips a complete native endpoint that is known not to contain the requested model', () => {
  const endpoints = [
    endpoint({ id: 'chat', protocol: 'openai', modelCatalogComplete: true }),
    endpoint({ id: 'responses', protocol: 'openai-responses', isDefault: true }),
  ];

  const chosen = selectProviderEndpoint(endpoints, 'openai', 'responses-only', [
    { endpointId: 'responses', modelId: 'responses-only' },
  ]);

  assert.equal(chosen?.id, 'responses');
});
test('uses an enabled default when the native endpoint is disabled', () => {
  const chosen = selectProviderEndpoint([
    endpoint({ id: 'chat', protocol: 'openai', enabled: false }),
    endpoint({ id: 'messages', protocol: 'anthropic', isDefault: true }),
  ], 'openai', 'any-model', []);

  assert.equal(chosen?.id, 'messages');
});

test('prefers a known compatible alternate before a default incompatible endpoint', () => {
  const chosen = selectProviderEndpoint([
    endpoint({ id: 'default-chat', protocol: 'openai', isDefault: true, modelCatalogComplete: true }),
    endpoint({ id: 'messages', protocol: 'anthropic', modelCatalogComplete: true }),
  ], 'responses', 'claude-model', [
    { endpointId: 'messages', modelId: 'claude-model' },
  ]);

  assert.equal(chosen?.id, 'messages');
});

test('uses deterministic protocol order after native and default candidates are unavailable', () => {
  const chosen = selectProviderEndpoint([
    endpoint({ id: 'gemini', protocol: 'gemini' }),
    endpoint({ id: 'messages', protocol: 'anthropic' }),
    endpoint({ id: 'responses', protocol: 'openai-responses' }),
  ], 'openai', 'unknown', []);

  assert.equal(chosen?.id, 'responses');
});

test('split complete catalogs route every entry protocol to an endpoint the model supports', () => {
  const endpoints = [
    endpoint({ id: 'chat', protocol: 'openai', isDefault: true, modelCatalogComplete: true }),
    endpoint({ id: 'responses', protocol: 'openai-responses', modelCatalogComplete: true }),
  ];
  const observations = [
    { endpointId: 'chat', modelId: 'chat-only' },
    { endpointId: 'chat', modelId: 'both' },
    { endpointId: 'responses', modelId: 'both' },
    { endpointId: 'responses', modelId: 'responses-only' },
    { endpointId: 'chat', modelId: 'manual' },
  ];
  assert.equal(selectProviderEndpoint(endpoints, 'openai', 'responses-only', observations)?.id, 'responses');
  assert.equal(selectProviderEndpoint(endpoints, 'responses', 'chat-only', observations)?.id, 'chat');
  assert.equal(selectProviderEndpoint(endpoints, 'responses', 'both', observations)?.id, 'responses');
  assert.equal(selectProviderEndpoint(endpoints, 'anthropic', 'responses-only', observations)?.id, 'responses');
  assert.equal(selectProviderEndpoint(endpoints, 'anthropic', 'manual', observations)?.id, 'chat');
  assert.equal(selectProviderEndpoint(endpoints, 'openai', 'unlisted', observations), undefined);
});

test('a preferred protocol wins only when its complete catalog confirms the model', () => {
  const endpoints = [
    endpoint({ id: 'chat', protocol: 'openai', isDefault: true, modelCatalogComplete: true }),
    endpoint({ id: 'responses', protocol: 'openai-responses', modelCatalogComplete: true }),
  ];
  const observations = [
    { endpointId: 'chat', modelId: 'both' },
    { endpointId: 'responses', modelId: 'both' },
    { endpointId: 'chat', modelId: 'chat-only' },
  ];
  assert.equal(selectProviderEndpoint(endpoints, 'openai', 'both', observations, 'openai-responses')?.id, 'responses');
  assert.equal(selectProviderEndpoint(endpoints, 'openai', 'chat-only', observations, 'openai-responses')?.id, 'chat');
  assert.equal(selectProviderEndpoint(endpoints, 'openai', 'both', observations)?.id, 'chat');
});
