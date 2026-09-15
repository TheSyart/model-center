/** Converges a model listed at several reasoning strengths into one base model.
 *
 * Catalogs such as Antigravity's list one model once per strength
 * (gemini-3.1-pro-low / gemini-3.1-pro-high, claude-opus-4-6-thinking, ...). Those entries
 * fold into a base model whose reasoning metadata maps each level to its upstream ID, so
 * clients pick strength with the reasoning parameter and the listing stays short. Grouping
 * uses the ID suffix first and the display name second, which also catches irregular IDs
 * whose label reads "(High)". Pure module: no database access, loadable by node:test. */
import {
  REASONING_EFFORTS,
  isReasoningEffort,
  type ModelReasoning,
  type ReasoningEffort,
} from '../gateway/reasoning.ts';
import type { DiscoveredModel, ModelEndpoint, SubscriptionVendor } from './types.ts';

export interface VariantEntry {
  id: string;
  displayName: string | null;
  endpoints?: ModelEndpoint[];
  maxOutputTokens?: number;
  /** Reasoning the catalog declares for this entry; levels of its own mark a distinct model. */
  reasoning?: ModelReasoning;
}

export interface FoldOptions {
  endpoints: ModelEndpoint[];
  /** Also fold a lone variant (gemini-3.6-flash-high); otherwise a sibling must exist. */
  foldSingles: boolean;
  /** ID suffixes read as a strength. Generic catalogs leave out xhigh/max, which usually
   * name separate products (gpt-5.1-codex-max). */
  effortSuffixes: readonly ReasoningEffort[];
  /** Control for families without a known rule; 'none' when the upstream ignores strength. */
  unknownControl: ModelReasoning['control'];
  /** Record claude-/gemini- control on plain models that carry no catalog metadata. */
  inferPlainControl: boolean;
}

const ALL_LEVELS = REASONING_EFFORTS.filter((effort) => effort !== 'none');

export function vendorFoldOptions(vendor: SubscriptionVendor): FoldOptions {
  if (vendor === 'antigravity' || vendor === 'gemini')
    return {
      endpoints: ['gemini'],
      foldSingles: true,
      effortSuffixes: ALL_LEVELS,
      unknownControl: 'none',
      inferPlainControl: true,
    };
  return {
    endpoints:
      vendor === 'codex' ? ['openai-responses'] : vendor === 'claude' ? ['anthropic'] : ['openai'],
    foldSingles: false,
    effortSuffixes: ['minimal', 'low', 'medium', 'high'],
    unknownControl: 'level',
    inferPlainControl: false,
  };
}

/** Irregular IDs Antigravity serves for one level, checked before the suffix rules and
 * listed in preference order: OmniRoute reports the advertised gemini-3.1-pro-high slot
 * answering 400 while gemini-pro-agent serves the high tier. */
const IRREGULAR: Record<string, { base: string; effort: ReasoningEffort }> = {
  'gemini-pro-agent': { base: 'gemini-3.1-pro', effort: 'high' },
  'gemini-3.1-pro-high': { base: 'gemini-3.1-pro', effort: 'high' },
};
const PREFERENCE = Object.keys(IRREGULAR);
const THINKING_SUFFIX = /^(.+)-(?:thinking|thought)$/;
const TIERED_SUFFIX = /^(.+)-tiered$/;
const LEVEL_LABEL = /\s*[(（]\s*(minimal|low|medium|high|xhigh|max|thinking)\s*[)）]\s*$/i;

export const cleanModelLabel = (name: string | null | undefined): string | null =>
  name ? name.replace(LEVEL_LABEL, '').trim() || null : null;

export const sortEfforts = (efforts: ReasoningEffort[]): ReasoningEffort[] =>
  [...new Set(efforts)].sort((a, b) => REASONING_EFFORTS.indexOf(a) - REASONING_EFFORTS.indexOf(b));

type Member = VariantEntry & {
  kind: 'base' | 'effort' | 'thinking' | 'tiered';
  effort?: ReasoningEffort;
};

function classify(entry: VariantEntry, options: FoldOptions): { base: string; member: Member } {
  const irregular = IRREGULAR[entry.id];
  if (irregular && options.foldSingles)
    return { base: irregular.base, member: { ...entry, kind: 'effort', effort: irregular.effort } };
  // A model that declares its own levels is a model in its own right.
  if (entry.reasoning?.efforts?.length) return { base: entry.id, member: { ...entry, kind: 'base' } };
  const thinking = THINKING_SUFFIX.exec(entry.id);
  if (thinking) return { base: thinking[1], member: { ...entry, kind: 'thinking' } };
  const tiered = TIERED_SUFFIX.exec(entry.id);
  if (tiered) return { base: tiered[1], member: { ...entry, kind: 'tiered' } };
  const suffix = /^(.+)-([a-z]+)$/.exec(entry.id);
  if (suffix && isReasoningEffort(suffix[2]) && options.effortSuffixes.includes(suffix[2]))
    return { base: suffix[1], member: { ...entry, kind: 'effort', effort: suffix[2] } };
  return { base: entry.id, member: { ...entry, kind: 'base' } };
}

/** A plain member whose label names a level becomes that level's variant. */
function relabel(member: Member): Member {
  if (member.kind !== 'base') return member;
  const tag = LEVEL_LABEL.exec(member.displayName ?? '')?.[1]?.toLowerCase();
  if (tag === 'thinking') return { ...member, kind: 'thinking' };
  if (isReasoningEffort(tag)) return { ...member, kind: 'effort', effort: tag };
  return member;
}

export function foldModelVariants(entries: VariantEntry[], options: FoldOptions): DiscoveredModel[] {
  const groups = new Map<string, Member[]>();
  for (const entry of entries) {
    const { base, member } = classify(entry, options);
    groups.set(base, [...(groups.get(base) ?? []), member]);
  }

  // Second pass by display name: groups whose labels match once "(High)" / "(Low)" are
  // removed are the same model, even when their IDs share nothing.
  const byLabel = new Map<string, string[]>();
  for (const [base, members] of groups)
    for (const member of members) {
      const tagged = LEVEL_LABEL.test(member.displayName ?? '') || member.kind !== 'base';
      const label = tagged ? cleanModelLabel(member.displayName)?.toLowerCase() : undefined;
      if (label && !byLabel.get(label)?.includes(base))
        byLabel.set(label, [...(byLabel.get(label) ?? []), base]);
    }
  for (const bases of byLabel.values()) {
    const present = bases.filter((base) => groups.has(base));
    if (present.length < 2) continue;
    const anchor = present.find((base) => groups.get(base)!.some((m) => m.kind !== 'base')) ?? present[0];
    const merged = present.flatMap((base) => groups.get(base)!).map(relabel);
    for (const base of present) groups.delete(base);
    groups.set(anchor, merged);
  }

  const rank = (id: string) => (PREFERENCE.includes(id) ? PREFERENCE.indexOf(id) : PREFERENCE.length);
  const folded: DiscoveredModel[] = [];
  for (const [base, members] of groups) {
    const lone = members.length === 1;
    if (members.every((m) => m.kind === 'base' && m.id === base) || (lone && !options.foldSingles)) {
      for (const member of members) folded.push(plainModel(member, options));
      continue;
    }
    const plain = members.find((m) => m.kind === 'base' && m.id === base);
    const thinking = members.find((m) => m.kind === 'thinking');
    const tiered = members.find((m) => m.kind === 'tiered');
    const control: ModelReasoning['control'] = base.startsWith('claude-')
      ? 'budget'
      : base.startsWith('gemini-')
        ? 'level'
        : (members.find((m) => m.reasoning)?.reasoning?.control ?? options.unknownControl);
    const variants: Partial<Record<ReasoningEffort, string>> = {};
    for (const member of [...members].sort((a, b) => rank(a.id) - rank(b.id)))
      if (member.kind === 'effort' && member.effort && !variants[member.effort])
        variants[member.effort] = member.id;
    const levels = sortEfforts(Object.keys(variants).filter(isReasoningEffort));
    const upstreamDefault =
      plain?.id ??
      tiered?.id ??
      variants.high ??
      (levels.length ? variants[levels[levels.length - 1]] : undefined) ??
      thinking?.id ??
      base;
    const reasoning: ModelReasoning = {
      control,
      upstreamDefault,
      legacyIds: [...new Set(members.map((m) => m.id))].filter((id) => id !== base),
    };
    if (plain?.reasoning?.efforts) reasoning.efforts = plain.reasoning.efforts;
    if (plain?.reasoning?.defaultEffort) reasoning.defaultEffort = plain.reasoning.defaultEffort;
    if (levels.length) reasoning.variants = variants;
    if (thinking && plain) reasoning.thinkingVariant = thinking.id;
    const maxOutput = (thinking ?? plain ?? members[0]).maxOutputTokens;
    if (control === 'budget' && maxOutput && maxOutput > 1) reasoning.budget = { max: maxOutput - 1 };
    const label = members.find((m) => m.id === upstreamDefault) ?? members[0];
    folded.push({
      id: base,
      displayName: cleanModelLabel(label.displayName),
      endpoints: [...new Set(members.flatMap((m) => m.endpoints ?? options.endpoints))],
      reasoning,
    });
  }
  return folded;
}

function plainModel(member: Member, options: FoldOptions): DiscoveredModel {
  let reasoning = member.reasoning;
  if (!reasoning && options.inferPlainControl) {
    if (member.id.startsWith('claude-'))
      reasoning = {
        control: 'budget',
        ...(member.maxOutputTokens && member.maxOutputTokens > 1
          ? { budget: { max: member.maxOutputTokens - 1 } }
          : {}),
      };
    else if (member.id.startsWith('gemini-')) reasoning = { control: 'level' };
  }
  return {
    id: member.id,
    displayName: cleanModelLabel(member.displayName),
    endpoints: member.endpoints ?? options.endpoints,
    ...(reasoning ? { reasoning } : {}),
  };
}
