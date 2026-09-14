/** Canonical reasoning ("thinking") intent shared by every gateway entry and upstream
 * protocol. Level/budget tables follow CLIProxyAPI internal/thinking (7fa443dc, MIT).
 * Pure module: no database or protocol imports, so node:test can load it directly. */

type Json = Record<string, any>;

export const REASONING_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export type ReasoningIntent =
  | { mode: 'effort'; effort: ReasoningEffort }
  /** Anthropic budget_tokens / Gemini thinkingBudget; 0 means no thinking. */
  | { mode: 'budget'; budget: number }
  /** Thinking requested without a level: let the model decide. */
  | { mode: 'auto' };

/** How a catalog model accepts reasoning strength, stored in models.reasoning_json. */
export interface ModelReasoning {
  /** Levels the upstream accepts, lowest first. Absent means "unknown, do not clamp". */
  efforts?: ReasoningEffort[];
  defaultEffort?: ReasoningEffort;
  /** How strength is sent beyond picking a variant. */
  control: 'level' | 'budget' | 'none';
  /** Upstream model IDs that encode a level, e.g. { low: 'gemini-3.1-pro-low' }. */
  variants?: Partial<Record<ReasoningEffort, string>>;
  /** Upstream ID used whenever thinking is requested at any level above none. */
  thinkingVariant?: string;
  /** Upstream ID used when the request carries no strength. */
  upstreamDefault?: string;
  /** Former catalog names folded into this model; still callable, never listed. */
  legacyIds?: string[];
  budget?: { min?: number; max?: number };
}

const ORDER: Record<ReasoningEffort, number> = {
  none: 0,
  minimal: 1,
  low: 2,
  medium: 3,
  high: 4,
  xhigh: 5,
  max: 6,
};

export const isReasoningEffort = (value: unknown): value is ReasoningEffort =>
  typeof value === 'string' && Object.hasOwn(ORDER, value);

const isObject = (value: unknown): value is Json =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const BUDGET: Record<Exclude<ReasoningEffort, 'none'>, number> = {
  minimal: 512,
  low: 1024,
  medium: 8192,
  high: 24576,
  xhigh: 32768,
  max: 128000,
};

export function effortToBudget(effort: ReasoningEffort): number {
  return effort === 'none' ? 0 : BUDGET[effort];
}

export function budgetToEffort(budget: number): ReasoningEffort {
  if (budget <= 0) return 'none';
  if (budget <= BUDGET.minimal) return 'minimal';
  if (budget <= BUDGET.low) return 'low';
  if (budget <= BUDGET.medium) return 'medium';
  if (budget <= BUDGET.high) return 'high';
  if (budget <= BUDGET.xhigh) return 'xhigh';
  return 'max';
}

/** The level an intent asks for; auto has none. */
export function intentEffort(intent: ReasoningIntent): ReasoningEffort | undefined {
  if (intent.mode === 'effort') return intent.effort;
  if (intent.mode === 'budget') return budgetToEffort(intent.budget);
  return undefined;
}

/** Nearest supported level, ties resolving lower; the top levels fall back through
 * xhigh, max, high before the generic nearest match. Unknown support is not clamped. */
export function clampEffort(
  effort: ReasoningEffort,
  supported: readonly ReasoningEffort[] | undefined
): ReasoningEffort {
  if (!supported?.length || supported.includes(effort)) return effort;
  if (effort === 'xhigh' || effort === 'max') {
    const order: ReasoningEffort[] =
      effort === 'xhigh' ? ['xhigh', 'max', 'high'] : ['max', 'xhigh', 'high'];
    const found = order.find((candidate) => supported.includes(candidate));
    if (found) return found;
  }
  let best = supported[0];
  for (const candidate of supported) {
    const distance = Math.abs(ORDER[candidate] - ORDER[effort]);
    const bestDistance = Math.abs(ORDER[best] - ORDER[effort]);
    if (distance < bestDistance || (distance === bestDistance && ORDER[candidate] < ORDER[best]))
      best = candidate;
  }
  return best;
}

/** Reads the client's reasoning controls from its own protocol. Invalid values are
 * treated as absent: nothing is rejected and the client's fields are left alone. */
export function extractReasoning(
  entry: 'openai' | 'responses' | 'anthropic',
  body: Json
): ReasoningIntent | undefined {
  if (entry === 'openai')
    return isReasoningEffort(body.reasoning_effort)
      ? { mode: 'effort', effort: body.reasoning_effort }
      : undefined;
  if (entry === 'responses') {
    const effort = isObject(body.reasoning) ? body.reasoning.effort : undefined;
    return isReasoningEffort(effort) ? { mode: 'effort', effort } : undefined;
  }
  const thinking = isObject(body.thinking) ? body.thinking : undefined;
  const effort = isObject(body.output_config) ? body.output_config.effort : undefined;
  if (thinking?.type === 'disabled') return { mode: 'effort', effort: 'none' };
  if (
    thinking?.type === 'enabled' &&
    typeof thinking.budget_tokens === 'number' &&
    Number.isFinite(thinking.budget_tokens) &&
    thinking.budget_tokens >= 0
  )
    return { mode: 'budget', budget: Math.floor(thinking.budget_tokens) };
  if (isReasoningEffort(effort)) return { mode: 'effort', effort };
  if (thinking?.type === 'adaptive') return { mode: 'auto' };
  return undefined;
}

/** Validates stored metadata; anything malformed is ignored rather than trusted. */
export function parseModelReasoning(value: unknown): ModelReasoning | null {
  if (typeof value !== 'string' || !value) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!isObject(parsed) || !['level', 'budget', 'none'].includes(parsed.control)) return null;
  const text = (v: unknown) => (typeof v === 'string' && v ? v : undefined);
  const reasoning: ModelReasoning = { control: parsed.control };
  if (Array.isArray(parsed.efforts)) {
    const efforts = parsed.efforts.filter(isReasoningEffort);
    if (efforts.length) reasoning.efforts = efforts;
  }
  if (isReasoningEffort(parsed.defaultEffort)) reasoning.defaultEffort = parsed.defaultEffort;
  if (isObject(parsed.variants)) {
    const variants: Partial<Record<ReasoningEffort, string>> = {};
    for (const [effort, id] of Object.entries(parsed.variants))
      if (isReasoningEffort(effort) && text(id)) variants[effort] = id as string;
    if (Object.keys(variants).length) reasoning.variants = variants;
  }
  if (text(parsed.thinkingVariant)) reasoning.thinkingVariant = parsed.thinkingVariant;
  if (text(parsed.upstreamDefault)) reasoning.upstreamDefault = parsed.upstreamDefault;
  if (Array.isArray(parsed.legacyIds)) {
    const ids = parsed.legacyIds.filter((id: unknown) => !!text(id));
    if (ids.length) reasoning.legacyIds = ids;
  }
  if (isObject(parsed.budget)) {
    const budget: { min?: number; max?: number } = {};
    if (Number.isFinite(parsed.budget.min)) budget.min = parsed.budget.min;
    if (Number.isFinite(parsed.budget.max)) budget.max = parsed.budget.max;
    if (Object.keys(budget).length) reasoning.budget = budget;
  }
  return reasoning;
}

/** The effort a folded variant name implies, if it names one. */
export function variantEffort(meta: ModelReasoning, upstreamId: string): ReasoningEffort | undefined {
  for (const [effort, id] of Object.entries(meta.variants ?? {}))
    if (id === upstreamId && isReasoningEffort(effort)) return effort;
  return undefined;
}

export interface ReasoningPlan {
  /** The model ID actually sent upstream. */
  upstreamModelId: string;
  /** Strength to express as request parameters; undefined sends none. */
  intent?: ReasoningIntent;
  /** A native passthrough body must be rewritten because the intent changed. */
  rewrite: boolean;
}

/**
 * Decides, for one routed model, which upstream ID and which parameters carry the
 * requested strength. The client's explicit parameter wins over a strength implied by
 * a legacy variant name; with neither, the vendor default applies untouched.
 */
export function planReasoning(
  modelId: string,
  meta: ModelReasoning | null | undefined,
  requested: ReasoningIntent | undefined,
  hint?: ReasoningEffort
): ReasoningPlan {
  const source: ReasoningIntent | undefined =
    requested ?? (hint ? { mode: 'effort', effort: hint } : undefined);
  const fromHint = !requested && !!hint;
  if (!meta) return { upstreamModelId: modelId, intent: source, rewrite: fromHint };
  const fallback = meta.upstreamDefault ?? modelId;
  if (meta.control === 'none')
    return { upstreamModelId: fallback, intent: undefined, rewrite: !!source };
  if (!source) return { upstreamModelId: fallback, intent: undefined, rewrite: false };
  if (source.mode === 'auto')
    return { upstreamModelId: meta.thinkingVariant ?? fallback, intent: source, rewrite: fromHint };

  const requestedEffort = intentEffort(source)!;
  const effort = clampEffort(requestedEffort, meta.efforts);
  const clamped = effort !== requestedEffort;
  const variants = meta.variants ?? {};
  const levels = (Object.keys(variants) as string[]).filter(isReasoningEffort);
  if (levels.length) {
    const exact = variants[effort];
    if (exact) return { upstreamModelId: exact, intent: undefined, rewrite: true };
    const nearest = clampEffort(effort, levels);
    return {
      upstreamModelId: variants[nearest]!,
      intent: { mode: 'effort', effort },
      rewrite: true,
    };
  }
  const upstream = effort !== 'none' && meta.thinkingVariant ? meta.thinkingVariant : fallback;
  if (source.mode === 'budget' && meta.control === 'budget') {
    let budget = source.budget;
    if (meta.budget?.max !== undefined) budget = Math.min(budget, meta.budget.max);
    if (meta.budget?.min !== undefined && budget > 0) budget = Math.max(budget, meta.budget.min);
    return {
      upstreamModelId: upstream,
      intent: { mode: 'budget', budget },
      rewrite: fromHint || budget !== source.budget,
    };
  }
  return {
    upstreamModelId: upstream,
    intent: { mode: 'effort', effort },
    rewrite: fromHint || clamped || source.mode === 'budget',
  };
}
