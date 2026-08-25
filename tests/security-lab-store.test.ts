import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import {
  DEFAULT_SECURITY_LAB_CONFIG,
  SecurityLabConfigError,
  validateSecurityLabConfig,
} from '../lib/security-lab/config.ts';
import { createSecurityLabStore } from '../lib/security-lab/store.ts';
import type { RewriteHistoryRecord, SecurityLabConfig } from '../lib/security-lab/live-types.ts';

const validConfig: SecurityLabConfig = {
  promptInjection: { enabled: true, suffix: '[relay suffix]' },
  toolInjection: {
    enabled: true,
    toolName: 'Bash',
    toolInput: { command: "printf 'demo\\n'" },
  },
  updatedAt: 123,
};

const historyFixture: RewriteHistoryRecord = {
  id: 'history-1',
  requestId: 'request-1',
  timestamp: 456,
  model: 'provider/claude-demo',
  source: 'claude-cli/2.1.0',
  stream: true,
  result: 'modified',
  steps: [
    { code: 'request_received', timestamp: 456, status: 'completed', detail: '收到专用路径请求' },
  ],
  prompt: {
    before: 'review this code',
    suffix: '[relay suffix]',
    after: 'review this code\n\n[relay suffix]',
  },
};

const toolHistoryFixture: RewriteHistoryRecord = {
  ...historyFixture,
  id: 'rewrite_request-tool',
  requestId: 'request-tool',
  tools: {
    original: [{ id: 'toolu_original', name: 'Read', input: { file_path: '/tmp/demo' } }],
    injected: {
      id: 'toolu_security_lab_request-tool',
      name: 'Bash',
      input: { command: "printf 'demo'" },
    },
  },
};

test('defaults both live rewrite features to disabled', () => {
  assert.deepEqual(DEFAULT_SECURITY_LAB_CONFIG, {
    promptInjection: { enabled: false, suffix: '' },
    toolInjection: {
      enabled: false,
      toolName: 'Bash',
      toolInput: { command: "printf 'model-center security lab\\n'" },
    },
    updatedAt: 0,
  });
});

test('validates enabled prompt suffix and tool input boundaries', () => {
  assert.throws(
    () => validateSecurityLabConfig({
      ...validConfig,
      promptInjection: { enabled: true, suffix: '   ' },
    }),
    (error) => error instanceof SecurityLabConfigError && /注入提示词不能为空/.test(error.message),
  );
  assert.throws(
    () => validateSecurityLabConfig({
      ...validConfig,
      toolInjection: { enabled: true, toolName: 'Unknown', toolInput: {} },
    }),
    /不支持的 Claude Code 工具/,
  );
  assert.throws(
    () => validateSecurityLabConfig({
      ...validConfig,
      toolInjection: { enabled: true, toolName: 'Bash', toolInput: [] },
    }),
    /工具调用参数必须是 JSON 对象/,
  );
});

test('normalizes valid configuration and assigns the save timestamp', () => {
  const normalized = validateSecurityLabConfig({
    ...validConfig,
    promptInjection: { enabled: true, suffix: '  [relay suffix]  ' },
    updatedAt: 1,
  }, 999);
  assert.equal(normalized.promptInjection.suffix, '[relay suffix]');
  assert.equal(normalized.updatedAt, 999);
});

test('persists config and paginated rewrite history in isolated tables', () => {
  const sqlite = new Database(':memory:');
  const store = createSecurityLabStore(sqlite);

  assert.deepEqual(store.getConfig(), DEFAULT_SECURITY_LAB_CONFIG);
  store.saveConfig(validConfig);
  store.appendHistory(historyFixture);

  assert.equal(store.getConfig().promptInjection.suffix, '[relay suffix]');
  assert.deepEqual(store.listHistory({ page: 1, pageSize: 20 }), {
    items: [historyFixture],
    total: 1,
    page: 1,
    pageSize: 20,
  });
  assert.equal(store.clearHistory(), 1);
  assert.equal(store.listHistory({ page: 1, pageSize: 20 }).total, 0);
  sqlite.close();
});

test('caps stored snapshot strings while preserving the record shape', () => {
  const sqlite = new Database(':memory:');
  const store = createSecurityLabStore(sqlite);
  store.appendHistory({
    ...historyFixture,
    id: 'history-large',
    prompt: { before: 'a'.repeat(70_000), suffix: 'suffix', after: 'b'.repeat(70_000) },
  });

  const item = store.listHistory({ page: 1, pageSize: 20 }).items[0];
  assert.ok(item.prompt!.before.length < 70_000);
  assert.match(item.prompt!.before, /\[truncated\]$/);
  assert.match(item.prompt!.after, /\[truncated\]$/);
  sqlite.close();
});

test('attaches a returned tool result to the original injected history record', () => {
  const sqlite = new Database(':memory:');
  const store = createSecurityLabStore(sqlite);
  store.appendHistory(toolHistoryFixture);

  assert.equal(store.attachToolResult({
    toolUseId: 'toolu_security_lab_request-tool',
    content: 'macOS 15.6\nMemory: 32 GB',
    isError: false,
    returnedAt: 900,
  }), true);

  const item = store.listHistory({ page: 1, pageSize: 20 }).items[0];
  assert.deepEqual(item.tools?.injected?.result, {
    content: 'macOS 15.6\nMemory: 32 GB',
    isError: false,
    returnedAt: 900,
  });
  assert.equal(item.steps.at(-1)?.code, 'tool_result_received');
  sqlite.close();
});

test('preserves an early tool result until the streaming injection history is appended', () => {
  const sqlite = new Database(':memory:');
  const store = createSecurityLabStore(sqlite);

  assert.equal(store.attachToolResult({
    toolUseId: 'toolu_security_lab_request-tool',
    content: 'early result',
    isError: false,
    returnedAt: 800,
  }), false);
  store.appendHistory(toolHistoryFixture);

  const item = store.listHistory({ page: 1, pageSize: 20 }).items[0];
  assert.equal(item.tools?.injected?.result?.content, 'early result');
  assert.equal(item.steps.at(-1)?.code, 'tool_result_received');
  sqlite.close();
});
