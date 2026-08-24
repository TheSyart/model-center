import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22 strip-types 直接执行测试时要求显式 .ts 扩展名。
// @ts-expect-error TS5097: runtime import intentionally includes the TypeScript extension.
import { cacheHitRate, detectRequestSource, effectiveTokenTotal, fillDailyActivity, normalizeAnthropicUsage, normalizeGeminiUsage, normalizeOpenAIUsage, normalizeResponsesUsage, normalizeUsageRangeForBucket, toPublicUsage, validateUsageRange } from '../lib/services/usage-metrics.ts';

test('normalizes OpenAI cached input without double counting prompt tokens', () => {
  const usage = normalizeOpenAIUsage({
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120,
    prompt_tokens_details: { cached_tokens: 40 },
  });

  assert.deepEqual(usage, {
    prompt_tokens: 100,
    completion_tokens: 20,
    total_tokens: 120,
    uncached_input_tokens: 60,
    cache_read_tokens: 40,
    cache_write_tokens: 0,
    cache_metrics_observed: true,
  });
  assert.equal(effectiveTokenTotal(usage), 120);
});

test('uses DeepSeek prompt cache hit tokens when detail object is absent', () => {
  const usage = normalizeOpenAIUsage({
    prompt_tokens: 80,
    completion_tokens: 10,
    prompt_cache_hit_tokens: 25,
  });

  assert.equal(usage?.uncached_input_tokens, 55);
  assert.equal(usage?.cache_read_tokens, 25);
  assert.equal(effectiveTokenTotal(usage), 90);
});

test('normalizes Responses cached input token details', () => {
  const usage = normalizeResponsesUsage({
    input_tokens: 64,
    output_tokens: 16,
    total_tokens: 80,
    input_tokens_details: { cached_tokens: 24 },
  });

  assert.equal(usage?.prompt_tokens, 64);
  assert.equal(usage?.uncached_input_tokens, 40);
  assert.equal(usage?.cache_read_tokens, 24);
  assert.equal(effectiveTokenTotal(usage), 80);
});

test('normalizes Anthropic cache creation and cache read as independent input classes', () => {
  const usage = normalizeAnthropicUsage({
    input_tokens: 12,
    output_tokens: 8,
    cache_read_input_tokens: 40,
    cache_creation_input_tokens: 10,
  });

  assert.deepEqual(usage, {
    prompt_tokens: 12,
    completion_tokens: 8,
    total_tokens: 20,
    uncached_input_tokens: 12,
    cache_read_tokens: 40,
    cache_write_tokens: 10,
    cache_metrics_observed: true,
  });
  assert.equal(effectiveTokenTotal(usage), 70);
});

test('normalizes Gemini cached content and protects against invalid negative counts', () => {
  const usage = normalizeGeminiUsage({
    promptTokenCount: 30,
    candidatesTokenCount: -5,
    totalTokenCount: 30,
    cachedContentTokenCount: 50,
  });

  assert.equal(usage?.completion_tokens, 0);
  assert.equal(usage?.uncached_input_tokens, 0);
  assert.equal(usage?.cache_read_tokens, 50);
  assert.equal(effectiveTokenTotal(usage), 50);
});

test('legacy usage falls back to total tokens and stays marked as unobserved', () => {
  const usage = normalizeOpenAIUsage({ prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 });

  assert.equal(usage?.cache_metrics_observed, false);
  assert.equal(usage?.uncached_input_tokens, 7);
  assert.equal(effectiveTokenTotal(usage), 10);
});

test('cache hit rate excludes legacy requests with unknown cache details', () => {
  assert.equal(cacheHitRate(0, 0, 0), null);
  assert.equal(cacheHitRate(60, 20, 2), 0.25);
  assert.equal(cacheHitRate(0, 0, 2), null);
});

test('public usage output never leaks internal cache accounting fields', () => {
  const usage = normalizeAnthropicUsage({
    input_tokens: 12,
    output_tokens: 8,
    cache_read_input_tokens: 40,
    cache_creation_input_tokens: 10,
  });

  assert.deepEqual(toPublicUsage(usage), {
    prompt_tokens: 12,
    completion_tokens: 8,
    total_tokens: 20,
  });
});

test('rejects reversed and overlong custom usage ranges', () => {
  assert.deepEqual(validateUsageRange(200, 100, 'hour'), { ok: false, error: 'from 必须早于 to' });
  assert.deepEqual(validateUsageRange(0, 91 * 86_400_000, 'day'), {
    ok: false,
    error: '自定义时间范围不能超过 90 天',
  });
  assert.deepEqual(validateUsageRange(0, 2 * 86_400_000, 'hour'), {
    ok: true,
    from: 0,
    to: 2 * 86_400_000,
    bucket: 'hour',
  });
  assert.deepEqual(validateUsageRange(0, 49 * 3_600_000, 'hour'), {
    ok: false,
    error: '小时粒度最多查询 48 小时',
  });
});

test('normalizes day buckets to honest local calendar-day boundaries', () => {
  const normalized = normalizeUsageRangeForBucket(
    new Date(2026, 7, 24, 12, 30).getTime(),
    new Date(2026, 7, 25, 12, 30).getTime(),
    'day',
  );
  assert.deepEqual(normalized, {
    from: new Date(2026, 7, 24).getTime(),
    to: new Date(2026, 7, 26).getTime(),
    bucket: 'day',
  });
});

test('classifies common gateway clients from their user agent', () => {
  assert.equal(detectRequestSource('claude-code/1.2.3'), 'claude_code');
  assert.equal(detectRequestSource('codex_cli_rs/0.80.0'), 'codex');
  assert.equal(detectRequestSource('CCSwitch/3.9'), 'cc_switch');
  assert.equal(detectRequestSource('OpenAI/Python 1.90'), 'openai_sdk');
  assert.equal(detectRequestSource(null), 'unknown');
});

test('fills missing heatmap dates with real zero-valued days', () => {
  const end = new Date(2026, 7, 24, 23, 59, 59).getTime();
  assert.deepEqual(
    fillDailyActivity([{ day: '2026-08-23', requests: 2, effective_tokens: 40, cost: 0.2 }], end, 3),
    [
      { day: '2026-08-22', requests: 0, effective_tokens: 0, cost: 0 },
      { day: '2026-08-23', requests: 2, effective_tokens: 40, cost: 0.2 },
      { day: '2026-08-24', requests: 0, effective_tokens: 0, cost: 0 },
    ],
  );
});
