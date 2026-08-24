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

test('log UI and API expose request protocols as entry while preserving user agent source', () => {
  const ui = fs.readFileSync(new URL('../app/(admin)/logs/logs-client.tsx', import.meta.url), 'utf8');
  const route = fs.readFileSync(new URL('../app/api/admin/logs/route.ts', import.meta.url), 'utf8');
  const service = fs.readFileSync(new URL('../lib/services/log.ts', import.meta.url), 'utf8');

  assert.match(ui, /入口协议/);
  assert.match(ui, /<option value="openai">Chat<\/option>/);
  assert.match(ui, /<option value="responses">Responses<\/option>/);
  assert.match(ui, /<option value="anthropic">Messages<\/option>/);
  assert.match(ui, /log\.entry_protocol/);
  assert.doesNotMatch(ui, /log\.client_name/);
  assert.match(ui, /log\.source/);
  assert.match(route, /entry: sp\.get\('entry'\)/);
  assert.match(service, /l\.entry_protocol =/);
});
