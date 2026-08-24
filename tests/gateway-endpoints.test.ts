import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22 strip-types 直接执行测试时要求显式 .ts 扩展名。
// @ts-expect-error TS5097: runtime import intentionally includes the TypeScript extension.
import { buildGatewayEndpoints } from '../lib/gateway-endpoints.ts';

test('builds every supported public endpoint from the current origin', () => {
  const guide = buildGatewayEndpoints('http://localhost:3001');

  assert.deepEqual(guide.protocols, [
    {
      id: 'openai-chat',
      label: 'OpenAI Chat',
      client: 'OpenAI SDK / 兼容客户端',
      baseUrl: 'http://localhost:3001/v1',
      endpoint: 'http://localhost:3001/v1/chat/completions',
    },
    {
      id: 'responses',
      label: 'Responses / Codex',
      client: 'Codex / Responses 客户端',
      baseUrl: 'http://localhost:3001/v1',
      endpoint: 'http://localhost:3001/v1/responses',
    },
    {
      id: 'anthropic',
      label: 'Anthropic',
      client: 'Claude Code / Anthropic SDK',
      baseUrl: 'http://localhost:3001',
      endpoint: 'http://localhost:3001/v1/messages',
    },
  ]);
  assert.equal(guide.modelsUrl, 'http://localhost:3001/v1/models');
});

test('removes trailing slashes before composing endpoint URLs', () => {
  const guide = buildGatewayEndpoints('https://models.example.com///');

  assert.equal(guide.protocols[0].baseUrl, 'https://models.example.com/v1');
  assert.equal(guide.protocols[2].baseUrl, 'https://models.example.com');
  assert.equal(guide.modelsUrl, 'https://models.example.com/v1/models');
});
