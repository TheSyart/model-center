import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { detectRequestClient, normalizeRequestSource } from '../lib/services/usage-metrics.ts';

test('detects coding clients from sanitized user agents', () => {
  const fixtures = [
    ['codex_cli_rs/0.42.0', 'codex', 'Codex'],
    ['claude-cli/2.1.0', 'claude-code', 'Claude Code'],
    ['kimi-code-cli/0.34.0', 'kimi-code', 'Kimi Code'],
    ['cc-switch/3.20.0', 'cc-switch', 'CC Switch'],
    ['GeminiCLI/1.2.3', 'gemini-cli', 'Gemini CLI'],
    ['opencode/1.0.0', 'opencode', 'OpenCode'],
  ] as const;
  for (const [source, key, name] of fixtures) {
    assert.deepEqual(detectRequestClient(source), { key, name });
  }
});

test('preserves source while classifying SDKs, curl and unknown clients', () => {
  const source = normalizeRequestSource('curl/8.7.1\u0000 internal');
  assert.equal(source, 'curl/8.7.1 internal');
  assert.deepEqual(detectRequestClient(source), { key: 'curl', name: 'cURL' });
  assert.deepEqual(detectRequestClient('strange-agent/1.0'), { key: 'unknown', name: '未知客户端' });
});

test('log UI exposes clients as entry and never protocol labels', () => {
  const source = fs.readFileSync(new URL('../app/(admin)/logs/logs-client.tsx', import.meta.url), 'utf8');
  assert.match(source, /请求客户端/);
  assert.match(source, /log\.client_name/);
  assert.doesNotMatch(source, /入口协议|>Chat<|>Responses<|>Messages</);
});
