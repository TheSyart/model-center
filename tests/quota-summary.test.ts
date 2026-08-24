import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22 strip-types 直接执行测试时要求显式 .ts 扩展名；生产代码仍使用项目默认解析规则。
// @ts-expect-error TS5097: runtime import intentionally includes the TypeScript extension.
import { formatQuotaSummary, type QuotaTier } from '../lib/services/coding-plan.ts';

test('formats the five-hour and seven-day windows in canonical order', () => {
  const tiers: QuotaTier[] = [
    { name: 'five_hour', utilization: 10, resets_at: null },
    { name: 'weekly_limit', utilization: 9, resets_at: null },
  ];

  assert.equal(formatQuotaSummary(tiers), '5小时 10% · 7天 9%');
});

test('normalizes reversed input into canonical order', () => {
  const tiers: QuotaTier[] = [
    { name: 'weekly_limit', utilization: 9, resets_at: null },
    { name: 'five_hour', utilization: 10, resets_at: null },
  ];

  assert.equal(formatQuotaSummary(tiers), '5小时 10% · 7天 9%');
});

test('formats a single available quota window', () => {
  const tiers: QuotaTier[] = [{ name: 'weekly_limit', utilization: 42, resets_at: null }];

  assert.equal(formatQuotaSummary(tiers), '7天 42%');
});

test('returns an explicit message for empty quota data', () => {
  assert.equal(formatQuotaSummary([]), '套餐额度暂无数据');
});

test('rounds utilization to the nearest integer', () => {
  const tiers: QuotaTier[] = [{ name: 'five_hour', utilization: 8.6, resets_at: null }];

  assert.equal(formatQuotaSummary(tiers), '5小时 9%');
});

test('clamps utilization above one hundred percent', () => {
  const tiers: QuotaTier[] = [{ name: 'five_hour', utilization: 118, resets_at: null }];

  assert.equal(formatQuotaSummary(tiers), '5小时 100%');
});

test('clamps utilization below zero percent', () => {
  const tiers: QuotaTier[] = [{ name: 'weekly_limit', utilization: -4, resets_at: null }];

  assert.equal(formatQuotaSummary(tiers), '7天 0%');
});

test('preserves unknown quota tier names without mutating the source array', () => {
  const tiers: QuotaTier[] = [
    { name: 'monthly_limit', utilization: 25, resets_at: null },
    { name: 'five_hour', utilization: 5, resets_at: null },
  ];
  const snapshot = structuredClone(tiers);

  assert.equal(formatQuotaSummary(tiers), '5小时 5% · monthly_limit 25%');
  assert.deepEqual(tiers, snapshot);
});
