export interface ModelPricingRow {
  modelId: string;
  displayName: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface PricingRepair extends ModelPricingRow {
  oldInput: number;
  oldOutput: number;
  oldCacheRead: number;
  oldCacheWrite: number;
}

export type CcSwitchSourceApp =
  | 'claude'
  | 'claude-desktop'
  | 'codex'
  | 'gemini'
  | 'grok-build'
  | 'opencode'
  | 'openclaw'
  | 'hermes'
  | 'pi'
  | 'universal';

export type NormalizedProtocol = 'openai' | 'openai-responses' | 'anthropic' | 'gemini';

export interface NormalizedModel {
  id: string;
  displayName?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  modalities?: unknown;
  reasoningLevels?: string[];
  defaultReasoningLevel?: string;
  capabilities?: Record<string, unknown>;
  pricing?: { input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null };
}

export interface NormalizedProvider {
  slug: string;
  name: string;
  protocol: NormalizedProtocol;
  baseUrl: string;
  category: string;
  sourceApps: string[];
  sourceRecords: Array<{ app: string; index: number }>;
  websiteUrl?: string;
  consoleUrl?: string;
  logo?: string;
  iconColor?: string;
  authMode: 'api-key' | 'oauth';
  apiKeyField?: string;
  endpointCandidates: string[];
  models: NormalizedModel[];
  supported: boolean;
  disabledReason?: string;
  official?: boolean;
  partner?: boolean;
  extra?: Record<string, unknown>;
}

export interface LogicalProviderCandidate {
  variantSlug: string;
  baseUrl: string;
  sourceApps: string[];
  supported: boolean;
  authMode: 'api-key' | 'oauth';
}

export interface LogicalProviderEndpoint {
  protocol: NormalizedProtocol;
  baseUrl: string;
  selectedVariantSlug: string;
  sourceApps: string[];
  knownModels: NormalizedModel[];
  modelCatalogComplete: false;
  alternateCandidates: LogicalProviderCandidate[];
}

export interface LogicalProviderPreset {
  presetKey: string;
  slug: string;
  name: string;
  category: string;
  logo?: string;
  websiteUrl?: string;
  consoleUrl?: string;
  supported: boolean;
  disabledReason?: string;
  authMode: 'api-key' | 'oauth';
  sourceApps: string[];
  extra?: Record<string, unknown>;
  defaultProtocol: NormalizedProtocol;
  endpoints: LogicalProviderEndpoint[];
  legacySlugs: string[];
  /** Default-endpoint compatibility fields consumed by existing callers. */
  protocol: NormalizedProtocol;
  baseUrl: string;
}

export interface LegacyProviderIdentity {
  slug: string;
  protocol: NormalizedProtocol;
  baseUrl: string;
}

export type NormalizedRecordResult =
  | { status: 'included'; provider: NormalizedProvider }
  | { status: 'excluded'; sourceApp: string; sourceIndex: number; reason: string; name?: string };

const PROVIDER_EXPORTS: Record<CcSwitchSourceApp, string> = {
  claude: 'providerPresets',
  'claude-desktop': 'claudeDesktopProviderPresets',
  codex: 'codexProviderPresets',
  gemini: 'geminiProviderPresets',
  'grok-build': 'grokBuildProviderPresets',
  opencode: 'opencodeProviderPresets',
  openclaw: 'openclawProviderPresets',
  hermes: 'hermesProviderPresets',
  pi: 'piProviderPresets',
  universal: 'universalProviderPresets',
};

/**
 * Resolve CC Switch's logical icon keys to the real files copied into
 * `public/logos`. Most inline icon keys match an extracted SVG basename, while
 * `iconUrls` and a small number of historical keys use different filenames.
 */
export function resolveIconAssetFiles(indexSource: string, assetFiles: string[]): Map<string, string> {
  const files = new Set(assetFiles);
  const result = new Map<string, string>();

  for (const file of assetFiles) {
    const key = file.replace(/\.[^.]+$/, '').toLowerCase();
    result.set(key, file);
  }

  const imports = new Map<string, string>();
  for (const match of indexSource.matchAll(/import\s+([A-Za-z_$][\w$]*)\s+from\s+["']\.\/([^"'?]+)(?:\?url)?["']/g)) {
    const [, symbol, file] = match;
    if (symbol && file && files.has(file)) imports.set(symbol, file);
  }

  const iconUrlsBody = indexSource.match(/export\s+const\s+iconUrls[^=]*=\s*\{([\s\S]*?)\};/)?.[1] ?? '';
  for (const match of iconUrlsBody.matchAll(/(?:["']([^"']+)["']|([A-Za-z0-9_-]+))\s*:\s*([A-Za-z_$][\w$]*)/g)) {
    const key = (match[1] ?? match[2])?.toLowerCase();
    const file = match[3] ? imports.get(match[3]) : undefined;
    if (key && file) result.set(key, file);
  }

  const aliases: Record<string, string> = {
    aigocode: 'algocode.svg',
    amux: 'amuxapi-icon.svg',
  };
  for (const [key, file] of Object.entries(aliases)) {
    if (files.has(file)) result.set(key, file);
  }

  return result;
}

export function collectProviderExports(sourceApp: CcSwitchSourceApp, moduleExports: Record<string, unknown>): Record<string, unknown>[] {
  const rows = moduleExports[PROVIDER_EXPORTS[sourceApp]];
  if (!Array.isArray(rows)) throw new Error(`${sourceApp} 未导出 ${PROVIDER_EXPORTS[sourceApp]} 数组`);
  const records = rows.map((row) => ({ ...(object(row) ?? {}) }));
  if (sourceApp === 'grok-build') {
    const official = object(moduleExports.grokBuildOfficialPreset);
    if (!official) throw new Error('grok-build 未导出 grokBuildOfficialPreset');
    records.unshift({ ...official });
  }
  return records;
}

function samePrice(a: number, b: number): boolean {
  return Object.is(a, b) || Math.abs(a - b) < 1e-12;
}

export function applyPricingRepairs(seed: ModelPricingRow[], repairs: PricingRepair[]): ModelPricingRow[] {
  const result = new Map<string, ModelPricingRow>();
  for (const row of seed) {
    if (!result.has(row.modelId)) result.set(row.modelId, { ...row });
  }
  for (const repair of repairs) {
    const current = result.get(repair.modelId);
    if (!current) continue;
    if (
      samePrice(current.input, repair.oldInput) &&
      samePrice(current.output, repair.oldOutput) &&
      samePrice(current.cacheRead, repair.oldCacheRead) &&
      samePrice(current.cacheWrite, repair.oldCacheWrite)
    ) {
      result.set(repair.modelId, {
        modelId: repair.modelId,
        displayName: repair.displayName,
        input: repair.input,
        output: repair.output,
        cacheRead: repair.cacheRead,
        cacheWrite: repair.cacheWrite,
      });
    }
  }
  return [...result.values()];
}

function arrayBody(source: string, variable: string): string {
  const match = source.match(new RegExp(`let\\s+${variable}\\s*=\\s*\\[([\\s\\S]*?)\\];`));
  if (!match) throw new Error(`CC Switch 定价源码缺少 ${variable} 数组`);
  return match[1] ?? '';
}

function tupleStrings(body: string, length: number): string[][] {
  const string = String.raw`"((?:[^"\\]|\\.)*)"`;
  const expression = new RegExp(`\\(\\s*${Array.from({ length }, () => string).join('\\s*,\\s*')}\\s*,?\\s*\\)`, 'g');
  return [...body.matchAll(expression)].map((match) =>
    Array.from({ length }, (_, index) => JSON.parse(`"${match[index + 1]}"`) as string),
  );
}

export function parseModelPricingSource(source: string): ModelPricingRow[] {
  const seed = tupleStrings(arrayBody(source, 'pricing_data'), 6).map(([modelId, displayName, input, output, cacheRead, cacheWrite]) => ({
    modelId,
    displayName,
    input: Number(input),
    output: Number(output),
    cacheRead: Number(cacheRead),
    cacheWrite: Number(cacheWrite),
  }));
  const repairs = tupleStrings(arrayBody(source, 'pricing_fixes'), 10).map(
    ([modelId, displayName, input, output, cacheRead, cacheWrite, oldInput, oldOutput, oldCacheRead, oldCacheWrite]) => ({
      modelId,
      displayName,
      input: Number(input),
      output: Number(output),
      cacheRead: Number(cacheRead),
      cacheWrite: Number(cacheWrite),
      oldInput: Number(oldInput),
      oldOutput: Number(oldOutput),
      oldCacheRead: Number(oldCacheRead),
      oldCacheWrite: Number(oldCacheWrite),
    }),
  );
  if (seed.some((row) => Object.values(row).some((value) => typeof value === 'number' && !Number.isFinite(value)))) {
    throw new Error('CC Switch 定价源码包含无效数字');
  }
  return applyPricingRepairs(seed, repairs);
}

function object(value: unknown): Record<string, any> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, any>) : null;
}

function cleanUrl(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '');
}

function tomlValue(config: unknown, key: string): string {
  if (typeof config !== 'string') return '';
  const match = config.match(new RegExp(`^\\s*${key}\\s*=\\s*["']([^"']+)["']`, 'm'));
  return match?.[1]?.trim() ?? '';
}

function findNestedString(value: unknown, keys: string[], depth = 0): string {
  if (depth > 5) return '';
  const current = object(value);
  if (!current) return '';
  for (const key of keys) {
    const candidate = current[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate;
  }
  for (const candidate of Object.values(current)) {
    const nested = findNestedString(candidate, keys, depth + 1);
    if (nested) return nested;
  }
  return '';
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'provider';
}

function protocolFor(sourceApp: string, raw: Record<string, any>): { protocol: NormalizedProtocol; unsupported?: string } {
  const api = String(
    raw.apiFormat ??
      raw.api ??
      object(raw.settingsConfig)?.api ??
      findNestedString(raw.settingsConfig, ['api', 'wire_api', 'wireApi']) ??
      tomlValue(raw.config, 'wire_api'),
  ).toLowerCase();
  const npmPackage = String(object(raw.settingsConfig)?.npm ?? '').toLowerCase();
  if (api.includes('bedrock') || npmPackage.includes('bedrock') || /bedrock/i.test(String(raw.name ?? ''))) {
    return { protocol: 'anthropic', unsupported: 'Bedrock 协议暂不受 Model Center 支持' };
  }
  if (api.includes('gemini') || api.includes('google-generative')) return { protocol: 'gemini' };
  if (api.includes('anthropic')) return { protocol: 'anthropic' };
  if (api.includes('response')) return { protocol: 'openai-responses' };
  if (api.includes('openai') || api.includes('chat') || api.includes('completion')) return { protocol: 'openai' };
  if (sourceApp === 'claude' || sourceApp === 'claude-desktop') return { protocol: 'anthropic' };
  if (sourceApp === 'gemini') return { protocol: 'gemini' };
  if (sourceApp === 'codex' || sourceApp === 'grok-build') return { protocol: 'openai-responses' };
  return { protocol: 'openai' };
}

function modelFrom(value: unknown): NormalizedModel | null {
  if (typeof value === 'string' && value.trim()) return { id: value.trim() };
  const row = object(value);
  if (!row) return null;
  const id = row.id ?? row.model ?? row.modelId ?? row.name ?? row.upstreamModel;
  if (typeof id !== 'string' || !id.trim()) return null;
  const cost = object(row.cost ?? row.pricing);
  const price = (field: string): number | null => {
    if (!cost || cost[field] == null || cost[field] === '') return null;
    const number = Number(cost[field]);
    return Number.isFinite(number) && number >= 0 ? number : null;
  };
  const normalizedFields = new Set([
    'id', 'model', 'modelId', 'upstreamModel', 'name', 'displayName',
    'contextWindow', 'context_length', 'contextLimit',
    'maxOutputTokens', 'max_tokens', 'outputLimit',
    'modalities', 'inputModalities', 'reasoningLevels', 'defaultReasoningLevel',
    'cost', 'pricing',
  ]);
  const capabilities = Object.fromEntries(
    Object.entries(row).filter(([key, child]) => !normalizedFields.has(key) && child !== undefined),
  );
  return {
    id: id.trim(),
    displayName: typeof row.displayName === 'string' ? row.displayName : typeof row.name === 'string' ? row.name : undefined,
    contextWindow: Number.isFinite(Number(row.contextWindow ?? row.context_length ?? row.contextLimit))
      ? Number(row.contextWindow ?? row.context_length ?? row.contextLimit)
      : undefined,
    maxOutputTokens: Number.isFinite(Number(row.maxOutputTokens ?? row.max_tokens ?? row.outputLimit))
      ? Number(row.maxOutputTokens ?? row.max_tokens ?? row.outputLimit)
      : undefined,
    modalities: row.modalities ?? row.inputModalities,
    reasoningLevels: Array.isArray(row.reasoningLevels) ? row.reasoningLevels.map(String) : undefined,
    defaultReasoningLevel: typeof row.defaultReasoningLevel === 'string' ? row.defaultReasoningLevel : undefined,
    capabilities: Object.keys(capabilities).length ? capabilities : undefined,
    pricing: cost
      ? { input: price('input'), output: price('output'), cacheRead: price('cacheRead'), cacheWrite: price('cacheWrite') }
      : undefined,
  };
}

function collectModels(raw: Record<string, any>): NormalizedModel[] {
  const candidates: unknown[] = [];
  if (typeof raw.model === 'string') candidates.push(raw.model);
  const configModel = tomlValue(raw.config, 'model');
  if (configModel) candidates.push(configModel);
  for (const value of [raw.modelCatalog, raw.routes]) {
    if (Array.isArray(value)) candidates.push(...value);
    else if (object(value)) candidates.push(...Object.entries(value).map(([id, details]) => ({ id, ...object(details) })));
  }
  const visitModelCollections = (value: unknown, depth = 0): void => {
    if (depth > 8) return;
    const current = object(value);
    if (!current) return;
    for (const [key, child] of Object.entries(current)) {
      if (key === 'models' || key === 'modelCatalog' || key === 'modelRoutes' || key === 'routes') {
        if (Array.isArray(child)) candidates.push(...child);
        else {
          const childObject = object(child);
          if (childObject && !('providers' in childObject)) {
            candidates.push(...Object.entries(childObject).map(([id, details]) => ({ id, ...(object(details) ?? {}) })));
          }
        }
      }
      if (child && typeof child === 'object') visitModelCollections(child, depth + 1);
    }
  };
  visitModelCollections(raw.settingsConfig);
  const unique = new Map<string, NormalizedModel>();
  for (const value of candidates) {
    const model = modelFrom(value);
    if (model) unique.set(model.id, { ...(unique.get(model.id) ?? {}), ...model });
  }
  return [...unique.values()];
}

export function normalizeProviderRecord(
  sourceApp: string,
  sourceIndex: number,
  rawInput: Record<string, unknown>,
): NormalizedRecordResult {
  const raw = rawInput as Record<string, any>;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : `${sourceApp}-${sourceIndex + 1}`;
  if (raw.isCustomTemplate === true) return { status: 'excluded', sourceApp, sourceIndex, reason: 'custom-template', name };

  let baseUrl = [
    raw.baseUrl,
    raw.baseURL,
    raw.base_url,
    findNestedString(raw.settingsConfig, [
        'ANTHROPIC_BASE_URL',
        'OPENAI_BASE_URL',
        'GEMINI_BASE_URL',
        'GOOGLE_GEMINI_BASE_URL',
        'baseUrl',
        'baseURL',
        'base_url',
      ]),
    tomlValue(raw.config, 'base_url'),
  ].map(cleanUrl).find(Boolean) ?? '';
  const protocol = protocolFor(sourceApp, raw);
  const officialBaseUrls: Record<string, string> = {
    'Claude Official': 'https://api.anthropic.com',
    'Claude Desktop Official': 'https://api.anthropic.com',
    'Google Official': 'https://generativelanguage.googleapis.com',
    'Grok Official': 'https://api.x.ai/v1',
  };
  baseUrl ||= officialBaseUrls[name] ?? '';
  const configurableBaseUrl = sourceApp === 'universal' && raw.providerType === 'newapi';
  const oauth =
    raw.requiresOAuth === true ||
    /oauth/i.test(String(raw.providerType ?? '')) ||
    (sourceApp === 'grok-build' && name === 'Grok Official');
  if (!baseUrl && !oauth && !protocol.unsupported && !configurableBaseUrl) {
    return { status: 'excluded', sourceApp, sourceIndex, reason: 'missing-base-url', name };
  }

  const supported = Boolean(baseUrl) && !oauth && !protocol.unsupported && !configurableBaseUrl;
  const sourceSlug = slugify(name);
  const slugSuffix = protocol.protocol === 'openai-responses' ? 'responses' : protocol.protocol;
  const env = object(object(raw.settingsConfig)?.env);
  const endpointCandidates = Array.isArray(raw.endpointCandidates)
    ? raw.endpointCandidates.map(cleanUrl).filter(Boolean)
    : [];
  return {
    status: 'included',
    provider: {
      slug: `${sourceSlug}-${slugSuffix}`,
      name,
      protocol: protocol.protocol,
      baseUrl,
      category: typeof raw.category === 'string' ? raw.category : raw.isOfficial ? 'official' : 'other',
      sourceApps: [sourceApp],
      sourceRecords: [{ app: sourceApp, index: sourceIndex }],
      websiteUrl: typeof raw.websiteUrl === 'string' ? raw.websiteUrl : undefined,
      consoleUrl: typeof raw.apiKeyUrl === 'string' ? raw.apiKeyUrl : undefined,
      logo: typeof raw.icon === 'string' ? `/logos/${raw.icon}.svg` : undefined,
      iconColor: typeof raw.iconColor === 'string' ? raw.iconColor : undefined,
      authMode: oauth ? 'oauth' : 'api-key',
      apiKeyField: typeof raw.apiKeyField === 'string' ? raw.apiKeyField : undefined,
      endpointCandidates,
      models: collectModels(raw),
      supported,
      disabledReason: oauth
        ? '需要 OAuth 登录，Model Center 暂不支持'
        : protocol.unsupported ?? (configurableBaseUrl ? '需要先填写自部署 Base URL' : undefined),
      official: raw.isOfficial === true,
      partner: raw.isPartner === true,
      extra: {
        ...(env ? { env } : {}),
        ...(typeof raw.config === 'string' ? { config: raw.config } : {}),
        ...(raw.suggestedDefaults ? { suggestedDefaults: raw.suggestedDefaults } : {}),
      },
    },
  };
}

function mergeModels(left: NormalizedModel[], right: NormalizedModel[]): NormalizedModel[] {
  const merged = new Map(left.map((model) => [model.id, model]));
  for (const model of right) merged.set(model.id, { ...(merged.get(model.id) ?? {}), ...model });
  return [...merged.values()];
}

export function mergeProviderRecords(records: NormalizedRecordResult[]): {
  providers: NormalizedProvider[];
  exclusions: Extract<NormalizedRecordResult, { status: 'excluded' }>[];
  coverage: { included: number; merged: number; excluded: number };
} {
  const providers = new Map<string, NormalizedProvider>();
  const exclusions: Extract<NormalizedRecordResult, { status: 'excluded' }>[] = [];
  let included = 0;
  let mergedCount = 0;
  for (const record of records) {
    if (record.status === 'excluded') {
      exclusions.push(record);
      continue;
    }
    const provider = record.provider;
    const key = `${slugify(provider.name)}|${provider.protocol}|${cleanUrl(provider.baseUrl).toLowerCase()}`;
    const current = providers.get(key);
    if (!current) {
      providers.set(key, { ...provider, sourceApps: [...provider.sourceApps], sourceRecords: [...provider.sourceRecords] });
      included += 1;
      continue;
    }
    current.sourceApps = [...new Set([...current.sourceApps, ...provider.sourceApps])];
    current.sourceRecords.push(...provider.sourceRecords);
    current.endpointCandidates = [...new Set([...current.endpointCandidates, ...provider.endpointCandidates])];
    current.models = mergeModels(current.models, provider.models);
    current.supported = current.supported && provider.supported;
    current.disabledReason ??= provider.disabledReason;
    mergedCount += 1;
  }
  const output = [...providers.values()];
  const usedSlugs = new Set<string>();
  for (const provider of output) {
    let slug = provider.slug;
    if (usedSlugs.has(slug)) {
      let host = '';
      try {
        host = new URL(provider.baseUrl).hostname.replace(/^www\./, '').split('.')[0] ?? '';
      } catch {
        host = provider.sourceApps[0] ?? 'variant';
      }
      const base = `${slug}-${slugify(host || 'variant')}`;
      slug = base;
      let suffix = 2;
      while (usedSlugs.has(slug)) slug = `${base}-${suffix++}`;
      provider.slug = slug;
    }
    usedSlugs.add(slug);
  }
  return {
    providers: output,
    exclusions,
    coverage: { included, merged: mergedCount, excluded: exclusions.length },
  };
}

const SEMANTIC_PROVIDER_ALIASES: Record<string, string> = {
  'Claude Desktop Official': 'Claude Official',
  'Google Official': 'Gemini Native',
  'xAI (Grok) OAuth': 'xAI (Grok)',
  'Grok Official': 'xAI (Grok)',
  'OpenAI Official': 'Codex',
  '火山Agentplan': '火山 Coding Plan',
  'StepFun Step Plan': 'StepFun',
  'Qwen Coder': 'Bailian',
  'AWS Bedrock': 'AWS Bedrock (AKSK)',
};

const DEFAULT_PROTOCOL_PRIORITY: NormalizedProtocol[] = ['openai', 'openai-responses', 'anthropic', 'gemini'];

const SOURCE_PRIORITY: Record<NormalizedProtocol, string[]> = {
  openai: ['opencode', 'openclaw', 'pi', 'hermes', 'codex'],
  'openai-responses': ['codex', 'grok-build'],
  anthropic: ['claude', 'claude-desktop'],
  gemini: ['gemini'],
};

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function sourceRank(provider: NormalizedProvider, protocol: NormalizedProtocol): [number, number] {
  const priorities = SOURCE_PRIORITY[protocol];
  const records = provider.sourceRecords.length
    ? provider.sourceRecords
    : provider.sourceApps.map((app, index) => ({ app, index }));
  return records.reduce<[number, number]>((best, record) => {
    const priority = priorities.indexOf(record.app);
    const candidate: [number, number] = [priority === -1 ? priorities.length : priority, record.index];
    return candidate[0] < best[0] || (candidate[0] === best[0] && candidate[1] < best[1]) ? candidate : best;
  }, [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
}

function compareCandidates(left: NormalizedProvider, right: NormalizedProvider, protocol: NormalizedProtocol): number {
  if (left.supported !== right.supported) return left.supported ? -1 : 1;
  const leftRank = sourceRank(left, protocol);
  const rightRank = sourceRank(right, protocol);
  if (leftRank[0] !== rightRank[0]) return leftRank[0] - rightRank[0];
  if (leftRank[1] !== rightRank[1]) return leftRank[1] - rightRank[1];
  return left.slug.localeCompare(right.slug);
}

/**
 * Creates stable logical provider cards from CC Switch's protocol/Base URL
 * variants. The input is never modified so the low-level catalog remains a
 * complete auditable source of candidates and legacy aliases.
 */
export function groupLogicalProviderPresets(
  providers: NormalizedProvider[],
  legacyPresets: LegacyProviderIdentity[] = [],
): {
  logicalProviders: LogicalProviderPreset[];
  semanticMergeCount: number;
} {
  const groups = new Map<string, { name: string; providers: NormalizedProvider[] }>();
  for (const provider of providers) {
    const name = SEMANTIC_PROVIDER_ALIASES[provider.name] ?? provider.name;
    const group = groups.get(name);
    if (group) group.providers.push(provider);
    else groups.set(name, { name, providers: [provider] });
  }

  const semanticMergeCount = new Set(providers.map((provider) => provider.name).filter((name) => SEMANTIC_PROVIDER_ALIASES[name])).size;
  const presetKeys = new Set<string>();
  const logicalProviders = [...groups.values()].map(({ name, providers: variants }) => {
    const basePresetKey = slugify(name);
    const legacy = legacyPresets.find((preset) => preset.slug === basePresetKey);
    const matchesLegacyEndpoint = legacy
      ? variants.some(
          (provider) => provider.protocol === legacy.protocol && cleanUrl(provider.baseUrl).toLowerCase() === cleanUrl(legacy.baseUrl).toLowerCase(),
        )
      : false;
    const preferredPresetKey = legacy && !matchesLegacyEndpoint ? `${basePresetKey}-cc-switch` : basePresetKey;
    let presetKey = preferredPresetKey;
    let suffix = 2;
    while (presetKeys.has(presetKey)) presetKey = `${preferredPresetKey}-${suffix++}`;
    presetKeys.add(presetKey);

    const endpoints = [...new Set(variants.map((provider) => provider.protocol))]
      .map((protocol) => {
        const candidates = variants.filter((provider) => provider.protocol === protocol).sort((left, right) => compareCandidates(left, right, protocol));
        const selected = candidates[0];
        if (!selected) throw new Error(`逻辑服务商 ${name} 缺少 ${protocol} 端点候选`);
        return {
          protocol,
          baseUrl: selected.baseUrl,
          selectedVariantSlug: selected.slug,
          sourceApps: uniqueStrings(candidates.flatMap((candidate) => candidate.sourceApps)),
          knownModels: [...selected.models],
          modelCatalogComplete: false as const,
          alternateCandidates: candidates.map((candidate) => ({
            variantSlug: candidate.slug,
            baseUrl: candidate.baseUrl,
            sourceApps: [...candidate.sourceApps],
            supported: candidate.supported,
            authMode: candidate.authMode,
          })),
        } satisfies LogicalProviderEndpoint;
      })
      .sort((left, right) => DEFAULT_PROTOCOL_PRIORITY.indexOf(left.protocol) - DEFAULT_PROTOCOL_PRIORITY.indexOf(right.protocol));
    const defaultEndpoint = [...endpoints].sort((left, right) => {
      const leftSupported = variants.find((provider) => provider.slug === left.selectedVariantSlug)?.supported ?? false;
      const rightSupported = variants.find((provider) => provider.slug === right.selectedVariantSlug)?.supported ?? false;
      if (leftSupported !== rightSupported) return leftSupported ? -1 : 1;
      return DEFAULT_PROTOCOL_PRIORITY.indexOf(left.protocol) - DEFAULT_PROTOCOL_PRIORITY.indexOf(right.protocol);
    })[0];
    if (!defaultEndpoint) throw new Error(`逻辑服务商 ${name} 缺少默认端点`);
    const selected = variants.find((provider) => provider.slug === defaultEndpoint.selectedVariantSlug);
    if (!selected) throw new Error(`逻辑服务商 ${name} 缺少默认变体`);

    return {
      presetKey,
      slug: presetKey,
      name,
      category: selected.category,
      logo: selected.logo,
      websiteUrl: selected.websiteUrl,
      consoleUrl: selected.consoleUrl,
      supported: selected.supported,
      disabledReason: selected.disabledReason,
      authMode: selected.authMode,
      sourceApps: uniqueStrings(variants.flatMap((provider) => provider.sourceApps)),
      extra: selected.extra,
      defaultProtocol: defaultEndpoint.protocol,
      endpoints,
      legacySlugs: endpoints.flatMap((endpoint) => endpoint.alternateCandidates.map((candidate) => candidate.variantSlug)),
      protocol: defaultEndpoint.protocol,
      baseUrl: defaultEndpoint.baseUrl,
    } satisfies LogicalProviderPreset;
  });

  return { logicalProviders, semanticMergeCount };
}
