import assert from 'node:assert/strict';
import test from 'node:test';
import Database from 'better-sqlite3';

import {
  historyPagination,
  saveSecurityLabConfigInput,
} from '../lib/security-lab/admin.ts';
import { DEFAULT_SECURITY_LAB_CONFIG } from '../lib/security-lab/config.ts';
import { createSecurityLabStore } from '../lib/security-lab/store.ts';

test('rejects invalid config without replacing the persisted value', () => {
  const sqlite = new Database(':memory:');
  const store = createSecurityLabStore(sqlite);
  const saved = saveSecurityLabConfigInput(store, {
    ...DEFAULT_SECURITY_LAB_CONFIG,
    promptInjection: { enabled: true, suffix: '[saved suffix]' },
  }, 100);

  assert.equal(saved.promptInjection.suffix, '[saved suffix]');
  assert.throws(() => saveSecurityLabConfigInput(store, {
    ...saved,
    toolInjection: { enabled: true, toolName: 'Bash', toolInput: [] },
  }, 200), /工具调用参数必须是 JSON 对象/);
  assert.equal(store.getConfig().promptInjection.suffix, '[saved suffix]');
  assert.equal(store.getConfig().updatedAt, 100);
  sqlite.close();
});

test('normalizes history pagination to stable API boundaries', () => {
  assert.deepEqual(historyPagination(new URLSearchParams('page=2&page_size=25')), { page: 2, pageSize: 25 });
  assert.deepEqual(historyPagination(new URLSearchParams('page=-4&page_size=500')), { page: 1, pageSize: 100 });
  assert.deepEqual(historyPagination(new URLSearchParams('page=nope&page_size=nope')), { page: 1, pageSize: 20 });
});
