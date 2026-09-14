import test from 'node:test';
import assert from 'node:assert/strict';
import {
  budgetToEffort,
  clampEffort,
  effortToBudget,
  extractReasoning,
  parseModelReasoning,
  planReasoning,
  type ModelReasoning,
} from '../lib/gateway/reasoning.ts';
import {
  applyAnthropicReasoning,
  applyGeminiReasoning,
  applyResponsesReasoning,
  claudeThinkingRules,
  stripRejectedClaudeSampling,
  writeNativeReasoning,
} from '../lib/protocols/reasoning-emit.ts';

type Json = Record<string, any>;

test('extracts one canonical intent from each entry protocol and ignores invalid values', () => {
  assert.deepEqual(extractReasoning('openai', { reasoning_effort: 'high' }), { mode: 'effort', effort: 'high' });
  assert.equal(extractReasoning('openai', { reasoning_effort: 'turbo' }), undefined);
  assert.equal(extractReasoning('openai', { reasoning_effort: 'toString' }), undefined);
  assert.deepEqual(extractReasoning('responses', { reasoning: { effort: 'low', summary: 'auto' } }), {
    mode: 'effort',
    effort: 'low',
  });
  assert.deepEqual(extractReasoning('anthropic', { thinking: { type: 'disabled' } }), { mode: 'effort', effort: 'none' });
  assert.deepEqual(extractReasoning('anthropic', { thinking: { type: 'enabled', budget_tokens: 4096.7 } }), {
    mode: 'budget',
    budget: 4096,
  });
  assert.deepEqual(
    extractReasoning('anthropic', { thinking: { type: 'adaptive' }, output_config: { effort: 'xhigh' } }),
    { mode: 'effort', effort: 'xhigh' }
  );
  assert.deepEqual(extractReasoning('anthropic', { thinking: { type: 'adaptive' } }), { mode: 'auto' });
  assert.equal(extractReasoning('anthropic', {}), undefined);
});

test('level and budget tables round-trip and clamping prefers the nearest lower level', () => {
  assert.equal(effortToBudget('medium'), 8192);
  assert.equal(budgetToEffort(8192), 'medium');
  assert.equal(budgetToEffort(8193), 'high');
  assert.equal(budgetToEffort(0), 'none');
  assert.equal(clampEffort('medium', ['low', 'high']), 'low');
  assert.equal(clampEffort('xhigh', ['low', 'medium', 'high', 'max']), 'max');
  assert.equal(clampEffort('max', ['low', 'high']), 'high');
  assert.equal(clampEffort('none', ['low', 'medium']), 'low');
  assert.equal(clampEffort('medium', undefined), 'medium');
});

test('stored reasoning metadata is validated before it is trusted', () => {
  assert.equal(parseModelReasoning('not json'), null);
  assert.equal(parseModelReasoning(JSON.stringify({ control: 'magic' })), null);
  assert.deepEqual(
    parseModelReasoning(
      JSON.stringify({ control: 'level', efforts: ['low', 'bogus', 'high'], variants: { low: 'x', turbo: 'y' }, legacyIds: ['x', 3] })
    ),
    { control: 'level', efforts: ['low', 'high'], variants: { low: 'x' }, legacyIds: ['x'] }
  );
});

const antigravityPro: ModelReasoning = {
  control: 'level',
  variants: { low: 'gemini-3.1-pro-low', high: 'gemini-pro-agent' },
  upstreamDefault: 'gemini-pro-agent',
  legacyIds: ['gemini-3.1-pro-low', 'gemini-pro-agent'],
};

test('plans the upstream variant from the requested strength, a legacy name or the vendor default', () => {
  assert.deepEqual(planReasoning('gemini-3.1-pro', antigravityPro, undefined), {
    upstreamModelId: 'gemini-pro-agent',
    intent: undefined,
    rewrite: false,
  });
  assert.deepEqual(planReasoning('gemini-3.1-pro', antigravityPro, { mode: 'effort', effort: 'low' }), {
    upstreamModelId: 'gemini-3.1-pro-low',
    intent: undefined,
    rewrite: true,
  });
  assert.equal(planReasoning('gemini-3.1-pro', antigravityPro, undefined, 'low').upstreamModelId, 'gemini-3.1-pro-low');
  // The explicit parameter beats the strength a legacy variant name implies.
  assert.equal(
    planReasoning('gemini-3.1-pro', antigravityPro, { mode: 'effort', effort: 'high' }, 'low').upstreamModelId,
    'gemini-pro-agent'
  );
  // No exact variant: the nearest variant plus the level as a parameter.
  assert.deepEqual(planReasoning('gemini-3.1-pro', antigravityPro, { mode: 'effort', effort: 'medium' }), {
    upstreamModelId: 'gemini-3.1-pro-low',
    intent: { mode: 'effort', effort: 'medium' },
    rewrite: true,
  });
});

test('plans clamp catalog levels, cap budgets and drop strength for models without control', () => {
  const codex: ModelReasoning = { control: 'level', efforts: ['low', 'medium', 'high', 'xhigh'], defaultEffort: 'medium' };
  assert.deepEqual(planReasoning('gpt-5.5', codex, { mode: 'effort', effort: 'max' }), {
    upstreamModelId: 'gpt-5.5',
    intent: { mode: 'effort', effort: 'xhigh' },
    rewrite: true,
  });
  assert.deepEqual(planReasoning('gpt-5.5', codex, { mode: 'effort', effort: 'high' }), {
    upstreamModelId: 'gpt-5.5',
    intent: { mode: 'effort', effort: 'high' },
    rewrite: false,
  });
  const claude: ModelReasoning = { control: 'budget', upstreamDefault: 'claude-opus-4-6-thinking', budget: { max: 63999 } };
  assert.deepEqual(planReasoning('claude-opus-4-6', claude, { mode: 'budget', budget: 100000 }), {
    upstreamModelId: 'claude-opus-4-6-thinking',
    intent: { mode: 'budget', budget: 63999 },
    rewrite: true,
  });
  const oss: ModelReasoning = { control: 'none', upstreamDefault: 'gpt-oss-120b-medium' };
  assert.deepEqual(planReasoning('gpt-oss-120b', oss, { mode: 'effort', effort: 'high' }), {
    upstreamModelId: 'gpt-oss-120b-medium',
    intent: undefined,
    rewrite: true,
  });
  assert.deepEqual(planReasoning('unknown', null, { mode: 'effort', effort: 'low' }), {
    upstreamModelId: 'unknown',
    intent: { mode: 'effort', effort: 'low' },
    rewrite: false,
  });
  const thinking: ModelReasoning = {
    control: 'budget',
    upstreamDefault: 'claude-sonnet-4-6',
    thinkingVariant: 'claude-sonnet-4-6-thinking',
  };
  assert.equal(planReasoning('claude-sonnet-4-6', thinking, { mode: 'effort', effort: 'high' }).upstreamModelId, 'claude-sonnet-4-6-thinking');
  assert.equal(planReasoning('claude-sonnet-4-6', thinking, { mode: 'effort', effort: 'none' }).upstreamModelId, 'claude-sonnet-4-6');
});

test('Claude thinking follows each model family', () => {
  const body = (): Json => ({ model: 'x', max_tokens: 2048, messages: [], temperature: 0.2 });
  const fable = body();
  applyAnthropicReasoning(fable, { mode: 'effort', effort: 'none' }, 'claude-fable-5-1');
  assert.deepEqual([fable.thinking, fable.output_config], [undefined, { effort: 'low' }]);
  const opus5 = body();
  applyAnthropicReasoning(opus5, { mode: 'effort', effort: 'minimal' }, 'claude-opus-5');
  assert.deepEqual([opus5.thinking, opus5.output_config], [{ type: 'adaptive' }, { effort: 'low' }]);
  const sonnet46 = body();
  applyAnthropicReasoning(sonnet46, { mode: 'effort', effort: 'xhigh' }, 'claude-sonnet-4-6');
  assert.deepEqual(sonnet46.output_config, { effort: 'max' });
  const haiku = body();
  applyAnthropicReasoning(haiku, { mode: 'effort', effort: 'high' }, 'claude-haiku-4-5');
  assert.deepEqual(haiku.thinking, { type: 'enabled', budget_tokens: 24576 });
  assert.equal(haiku.max_tokens, 24576 + 4096);
  assert.equal(haiku.temperature, undefined);
  const off = body();
  applyAnthropicReasoning(off, { mode: 'effort', effort: 'none' }, 'claude-opus-4-8');
  assert.deepEqual(off.thinking, { type: 'disabled' });
  const auto = body();
  applyAnthropicReasoning(auto, { mode: 'auto' }, 'claude-opus-4-7');
  assert.deepEqual([auto.thinking, auto.output_config], [{ type: 'adaptive' }, undefined]);
  assert.equal(claudeThinkingRules('claude-3-5-sonnet-20241022')?.mode, 'unsupported');
  assert.equal(claudeThinkingRules('claude-sonnet-4.5')?.mode, 'budget');
  assert.equal(claudeThinkingRules('claude-opus-4-7')?.rejectsSampling, true);
  assert.equal(claudeThinkingRules('claude-sonnet-4-6')?.rejectsSampling, false);
  assert.equal(claudeThinkingRules('gpt-5'), null);
  const sampled: Json = { temperature: 0.5, top_p: 0.9, top_k: 5 };
  stripRejectedClaudeSampling(sampled, 'claude-sonnet-5');
  assert.deepEqual(sampled, {});
});

test('native rewrites replace nested objects instead of mutating the client request', () => {
  const client: Json = { reasoning: { effort: 'max', summary: 'auto' } };
  const copy: Json = { ...client };
  writeNativeReasoning('openai-responses', copy, { mode: 'effort', effort: 'xhigh' }, 'gpt-5.5');
  assert.deepEqual(copy.reasoning, { effort: 'xhigh', summary: 'auto' });
  assert.deepEqual(client.reasoning, { effort: 'max', summary: 'auto' });
  const anthropic: Json = {
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: 'max', format: { type: 'json_schema' } },
  };
  const next: Json = { ...anthropic };
  writeNativeReasoning('anthropic', next, { mode: 'effort', effort: 'low' }, 'claude-opus-4-7');
  assert.deepEqual(next.thinking, { type: 'adaptive', display: 'summarized' });
  assert.deepEqual(next.output_config, { format: { type: 'json_schema' }, effort: 'low' });
  assert.equal(anthropic.output_config.effort, 'max');
  const chat: Json = { reasoning_effort: 'high' };
  writeNativeReasoning('openai', chat, undefined, 'gpt-5.5');
  assert.equal('reasoning_effort' in chat, false);
  const responses: Json = { reasoning: { effort: 'high' } };
  applyResponsesReasoning(responses, undefined);
  assert.equal('reasoning' in responses, false);
});

test('Gemini uses thinkingLevel for Gemini 3, thinkingBudget for 2.x and Claude, never both', () => {
  const gemini3: Json = { generationConfig: { temperature: 1, thinkingConfig: { thinkingBudget: 99, includeThoughts: true } } };
  applyGeminiReasoning(gemini3, { mode: 'effort', effort: 'xhigh' }, 'gemini-3.1-pro-low');
  assert.deepEqual(gemini3.generationConfig, { temperature: 1, thinkingConfig: { includeThoughts: true, thinkingLevel: 'high' } });
  const pro: Json = {};
  applyGeminiReasoning(pro, { mode: 'effort', effort: 'minimal' }, 'gemini-3.1-pro');
  assert.deepEqual(pro, { generationConfig: { thinkingConfig: { thinkingLevel: 'low' } } });
  const flash25: Json = {};
  applyGeminiReasoning(flash25, { mode: 'effort', effort: 'none' }, 'gemini-2.5-flash');
  assert.deepEqual(flash25, { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } });
  const claude: Json = { generationConfig: { maxOutputTokens: 4096 } };
  applyGeminiReasoning(claude, { mode: 'effort', effort: 'high' }, 'claude-opus-4-6-thinking');
  assert.deepEqual(claude.generationConfig, { maxOutputTokens: 24576 + 4096, thinkingConfig: { thinkingBudget: 24576 } });
  const off: Json = { generationConfig: { thinkingConfig: { thinkingBudget: 1024 } } };
  applyGeminiReasoning(off, { mode: 'effort', effort: 'none' }, 'claude-opus-4-6-thinking');
  assert.deepEqual(off, {});
});
