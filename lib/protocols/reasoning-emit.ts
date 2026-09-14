/** Writes a canonical reasoning intent into each upstream protocol's request body.
 *
 * Claude rules follow the current Messages API: 4.6 and later use adaptive thinking with
 * output_config.effort; budget_tokens is rejected from Opus 4.7 / Sonnet 5 on and sampling
 * parameters are rejected there too; Fable/Mythos cannot turn thinking off; Haiku 4.5 and
 * older still take budget_tokens (>= 1024 and < max_tokens). Gemini 3 takes thinkingLevel,
 * Gemini 2.x and Claude-on-Antigravity take thinkingBudget, and the two are never mixed.
 * Every helper replaces nested objects instead of mutating them, because a passthrough
 * body shares nested objects with the client request reused across failover targets. */
import {
  clampEffort,
  effortToBudget,
  intentEffort,
  type ReasoningEffort,
  type ReasoningIntent,
} from '../gateway/reasoning.ts';

type Json = Record<string, any>;
const isObject = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const CLAUDE_FULL: readonly ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh', 'max'];

export interface ClaudeThinkingRules {
  mode: 'always' | 'adaptive' | 'budget' | 'unsupported';
  efforts: readonly ReasoningEffort[];
  /** temperature / top_p / top_k return a 400 on this model. */
  rejectsSampling: boolean;
}

export function claudeThinkingRules(modelId: string): ClaudeThinkingRules | null {
  const id = modelId.toLowerCase();
  if (!id.includes('claude')) return null;
  const modern = /claude-(opus|sonnet|haiku|fable|mythos)-(\d+)(?:[-.](\d{1,2}))?(?!\d)/.exec(id);
  if (modern) {
    const [, family, major, minor] = modern;
    const version = Number(major) + Number(minor ?? 0) / 10;
    if (family === 'fable' || family === 'mythos')
      return { mode: 'always', efforts: CLAUDE_FULL, rejectsSampling: true };
    if (family === 'haiku') return { mode: 'budget', efforts: [], rejectsSampling: false };
    if (version >= 5 || (family === 'opus' && version >= 4.7))
      return { mode: 'adaptive', efforts: CLAUDE_FULL, rejectsSampling: true };
    if (version >= 4.6)
      return { mode: 'adaptive', efforts: ['low', 'medium', 'high', 'max'], rejectsSampling: false };
    return { mode: 'budget', efforts: [], rejectsSampling: false };
  }
  if (/claude-\d/.test(id))
    return id.includes('3-7')
      ? { mode: 'budget', efforts: [], rejectsSampling: false }
      : { mode: 'unsupported', efforts: [], rejectsSampling: false };
  return { mode: 'adaptive', efforts: CLAUDE_FULL, rejectsSampling: false };
}

function withoutEffort(body: Json) {
  if (!isObject(body.output_config)) return;
  const { effort: _effort, ...rest } = body.output_config;
  if (Object.keys(rest).length) body.output_config = rest;
  else delete body.output_config;
}

export function applyAnthropicReasoning(
  body: Json,
  intent: ReasoningIntent | undefined,
  modelId: string
): void {
  const rules = claudeThinkingRules(modelId);
  const display = isObject(body.thinking) ? body.thinking.display : undefined;
  delete body.thinking;
  withoutEffort(body);
  if (!intent || rules?.mode === 'unsupported') return;
  const setEffort = (effort: ReasoningEffort) => {
    body.output_config = {
      ...(isObject(body.output_config) ? body.output_config : {}),
      effort,
    };
  };
  const adaptive = () => ({ type: 'adaptive', ...(display ? { display } : {}) });
  const mode = rules?.mode ?? 'adaptive';
  const efforts = rules?.efforts ?? CLAUDE_FULL;
  if (mode === 'budget') {
    const effort = intentEffort(intent);
    const requested =
      intent.mode === 'budget'
        ? intent.budget
        : effortToBudget(intent.mode === 'auto' ? 'medium' : effort!);
    if (requested <= 0) return;
    const budget = Math.max(1024, requested);
    body.thinking = { type: 'enabled', budget_tokens: budget };
    if (typeof body.max_tokens !== 'number' || body.max_tokens <= budget)
      body.max_tokens = budget + 4096;
    // Extended thinking does not accept temperature/top_k changes or a narrow top_p.
    delete body.temperature;
    delete body.top_k;
    if (typeof body.top_p === 'number' && body.top_p < 0.95) delete body.top_p;
    return;
  }
  if (intent.mode === 'auto') {
    body.thinking = adaptive();
    return;
  }
  const effort = intentEffort(intent)!;
  if (effort === 'none') {
    if (mode === 'always') setEffort(clampEffort('low', efforts));
    else body.thinking = { type: 'disabled' };
    return;
  }
  body.thinking = adaptive();
  setEffort(clampEffort(effort === 'minimal' ? 'low' : effort, efforts));
}

/** Removes sampling parameters the target Claude model rejects outright. */
export function stripRejectedClaudeSampling(body: Json, modelId: string): void {
  if (!claudeThinkingRules(modelId)?.rejectsSampling) return;
  delete body.temperature;
  delete body.top_p;
  delete body.top_k;
}

export function applyChatReasoning(body: Json, intent: ReasoningIntent | undefined): void {
  delete body.reasoning_effort;
  const effort = intent && intentEffort(intent);
  if (effort) body.reasoning_effort = effort;
}

export function applyResponsesReasoning(body: Json, intent: ReasoningIntent | undefined): void {
  const effort = intent && intentEffort(intent);
  const { effort: _old, ...rest } = isObject(body.reasoning) ? body.reasoning : {};
  if (effort) body.reasoning = { ...rest, effort };
  else if (Object.keys(rest).length) body.reasoning = rest;
  else delete body.reasoning;
}

export function applyGeminiReasoning(
  body: Json,
  intent: ReasoningIntent | undefined,
  modelId: string,
  options: { control?: 'level' | 'budget' | 'none'; maxBudget?: number } = {}
): void {
  const config: Json = isObject(body.generationConfig) ? { ...body.generationConfig } : {};
  const {
    thinkingLevel: _level,
    thinkingBudget: _budget,
    ...kept
  } = isObject(config.thinkingConfig) ? config.thinkingConfig : {};
  const commit = (thinking?: Json) => {
    const next = { ...kept, ...(thinking ?? {}) };
    if (Object.keys(next).length) config.thinkingConfig = next;
    else delete config.thinkingConfig;
    if (Object.keys(config).length) body.generationConfig = config;
    else delete body.generationConfig;
  };
  if (!intent || options.control === 'none') return commit();
  const id = modelId.toLowerCase();
  const claude = id.includes('claude');
  const pro = id.includes('pro');
  const effort = intentEffort(intent);
  const budgetMode =
    options.control === 'budget' ||
    claude ||
    /gemini-[12][.-]/.test(id) ||
    intent.mode === 'budget';
  if (budgetMode) {
    if (intent.mode === 'auto')
      return commit({ thinkingBudget: claude ? effortToBudget('medium') : -1 });
    if (effort === 'none') return claude ? commit() : commit({ thinkingBudget: pro ? 128 : 0 });
    let budget = intent.mode === 'budget' ? intent.budget : effortToBudget(effort!);
    if (options.maxBudget) budget = Math.min(budget, options.maxBudget);
    if (claude) {
      budget = Math.max(1024, budget);
      if (typeof config.maxOutputTokens === 'number' && config.maxOutputTokens <= budget)
        config.maxOutputTokens = budget + 4096;
    }
    return commit({ thinkingBudget: budget });
  }
  // Gemini 3 thinks dynamically by default; auto keeps that default.
  if (intent.mode === 'auto') return commit();
  const level =
    effort === 'none' || effort === 'minimal'
      ? pro
        ? 'low'
        : 'minimal'
      : effort === 'xhigh' || effort === 'max'
        ? 'high'
        : effort;
  commit({ thinkingLevel: level });
}

/** Rewrites a native passthrough body for the selected upstream protocol. */
export function writeNativeReasoning(
  protocol: string,
  body: Json,
  intent: ReasoningIntent | undefined,
  modelId: string,
  control?: 'level' | 'budget' | 'none'
): void {
  if (protocol === 'openai') applyChatReasoning(body, intent);
  else if (protocol === 'openai-responses') applyResponsesReasoning(body, intent);
  else if (protocol === 'anthropic') applyAnthropicReasoning(body, intent, modelId);
  else if (protocol === 'gemini') applyGeminiReasoning(body, intent, modelId, { control });
}
