/** 三态能力：true 支持、false 不支持、undefined 没有证据（未知）。
 * 「未知」绝不等同于「不支持」，也绝不渲染成「支持」。 */
export type CapabilityState = boolean | undefined;

export type CapabilityId =
  | 'vision'
  | 'tools'
  | 'reasoning'
  | 'asr'
  | 'tts'
  | 'web_search'
  | 'code';

export interface ModelCapabilityTag {
  id: 'vision' | 'tools' | 'reasoning' | 'asr' | 'tts' | 'web_search' | 'code';
  label: string;
  color: string;
  description?: string;
}

export interface ModelCapabilities {
  vision?: boolean;
  tools?: boolean;
  reasoning?: boolean;
  asr?: boolean;
  tts?: boolean;
  web_search?: boolean;
  code?: boolean;
  rawCapabilities?: string[];
  rawFeatures?: string[];
  modalities?: string[];
}

export interface ExactModelSpec {
  displayName?: string;
  contextWindow?: number;
  maxOutputTokens?: number;
  vision: boolean;
  tools: boolean;
  reasoning: boolean;
  code?: boolean;
  asr?: boolean;
  tts?: boolean;
  webSearch?: boolean;
}

/**
 * 官方权威模型规格字典（涵盖 DeepSeek 最新规范、Kimi、OpenAI、Anthropic 等）。
 * 优先级高于模糊规则猜测。
 */
export const EXACT_MODEL_SPECS: Record<string, ExactModelSpec> = {
  // DeepSeek 官方最新规范 (来源: https://api-docs.deepseek.com/zh-cn/quick_start/pricing)
  'deepseek-flash': {
    displayName: 'DeepSeek-V4.1-Flash',
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
    vision: true, // 官方文档明确：图像理解 支持
    tools: true, // 官方文档明确：Tool Calls 支持
    reasoning: true, // 官方文档明确：思考模式 支持（默认）
    code: true,
  },
  'deepseek-v4-pro': {
    displayName: 'DeepSeek-V4-Pro',
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
    vision: false, // 官方文档明确：图像理解 不支持
    tools: true, // 官方文档明确：Tool Calls 支持
    reasoning: true, // 官方文档明确：思考模式 支持（默认）
    code: true,
  },
  'deepseek-chat': {
    displayName: 'DeepSeek-Chat',
    contextWindow: 1_000_000,
    maxOutputTokens: 384_000,
    vision: true,
    tools: true,
    reasoning: true,
    code: true,
  },
  'deepseek-reasoner': {
    displayName: 'DeepSeek-R1 (Reasoner)',
    contextWindow: 128_000,
    maxOutputTokens: 64_000,
    vision: false,
    tools: false,
    reasoning: true,
    code: true,
  },

  // Kimi 的四条已删除：api.kimi.com/coding/v1/models 提供活的能力目录，
  // 手工字典与它冲突（实测 kimi-for-coding-highspeed 不支持工具调用、k3 上下文是 1M
  // 而非字典里的 256k）。见 lib/vendors/kimi/catalog.ts。

  // OpenAI
  'gpt-4o': {
    displayName: 'GPT-4o',
    contextWindow: 128_000,
    vision: true,
    tools: true,
    reasoning: false,
  },
  'gpt-4o-mini': {
    displayName: 'GPT-4o mini',
    contextWindow: 128_000,
    vision: true,
    tools: true,
    reasoning: false,
  },
  'o1': {
    displayName: 'OpenAI o1',
    contextWindow: 200_000,
    vision: true,
    tools: true,
    reasoning: true,
  },
  'o3-mini': {
    displayName: 'OpenAI o3-mini',
    contextWindow: 200_000,
    vision: false,
    tools: true,
    reasoning: true,
  },

  // Anthropic Claude
  'claude-3-7-sonnet-20250219': {
    displayName: 'Claude 3.7 Sonnet',
    contextWindow: 200_000,
    vision: true,
    tools: true,
    reasoning: true,
  },
  'claude-3-5-sonnet-20241022': {
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200_000,
    vision: true,
    tools: true,
    reasoning: false,
  },
  'claude-3-5-haiku-20241022': {
    displayName: 'Claude 3.5 Haiku',
    contextWindow: 200_000,
    vision: false,
    tools: true,
    reasoning: false,
  },
};

/** 获取知名模型的官方规格（若有） */
export function lookupExactModelSpec(modelId: string): ExactModelSpec | undefined {
  const exact = EXACT_MODEL_SPECS[modelId];
  if (exact) return exact;
  const lower = modelId.toLowerCase();
  return EXACT_MODEL_SPECS[lower];
}

const TAG_META: Record<CapabilityId, Omit<ModelCapabilityTag, 'id'>> = {
  vision: { label: '视觉', color: 'blue', description: '支持图片/多模态输入' },
  tools: { label: '工具调用', color: 'purple', description: '支持 Function/Tool Calling' },
  reasoning: { label: '深度思考', color: 'amber', description: '支持 Reasoning/Thinking' },
  asr: { label: '语音识别', color: 'emerald', description: 'ASR 语音转文字' },
  tts: { label: '语音合成', color: 'cyan', description: 'TTS 文本转语音' },
  web_search: { label: '联网搜索', color: 'indigo', description: '内置联网搜索' },
  code: { label: '代码', color: 'slate', description: '代码生成与编程专精' },
};

/**
 * 解析模型能力，只在**有证据**时给出结论。
 *
 * 证据来源按优先级：
 *  1. `capabilities_json` 中已存下的明确布尔值（来自官方目录）
 *  2. `EXACT_MODEL_SPECS` 官方规格字典
 *  3. 官方目录的 `capabilities` / `features` 原始枚举——列表非空却不含某能力，
 *     是该厂商给出的**否定证据**，可判定为 false
 *  4. `reasoning_json` 存在，说明该模型确实配置了思考参数
 *
 * 模型名子串只用于**反证**（embedding / rerank 不做工具调用），不用于正面断言：
 * 「名字里没有 embedding」不构成「支持工具调用」的证据。
 */
export function resolveModelCapabilityStates(
  modelId: string,
  capabilitiesJson?: string | null,
  reasoningJson?: string | null,
): Record<CapabilityId, CapabilityState> {
  let stored: ModelCapabilities = {};
  if (capabilitiesJson) {
    try {
      const parsed: unknown = JSON.parse(capabilitiesJson);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        stored = parsed as ModelCapabilities;
      }
    } catch {
      // 损坏的 JSON 视为没有证据，而不是视为不支持
    }
  }

  const rawCaps = new Set(stored.rawCapabilities ?? []);
  const rawFeats = new Set(stored.rawFeatures ?? []);
  const modalities = new Set(stored.modalities ?? []);
  const hasCapList = rawCaps.size > 0;
  const hasFeatList = rawFeats.size > 0;
  const hasModalityList = modalities.size > 0;

  const lower = modelId.toLowerCase();
  const exact = lookupExactModelSpec(modelId);

  /** 命中任一枚举即 true；枚举表非空却没命中即 false；否则未知。 */
  const fromList = (
    present: boolean,
    listPopulated: boolean,
  ): CapabilityState => (present ? true : listPopulated ? false : undefined);

  const vision: CapabilityState =
    stored.vision ??
    exact?.vision ??
    fromList(
      rawCaps.has('VU') ||
        rawCaps.has('Multimodal-Omni') ||
        rawCaps.has('Realtime-Omni') ||
        modalities.has('Image') ||
        modalities.has('image'),
      hasCapList || hasModalityList,
    );

  // 嵌入与重排模型不做工具调用，这是反证而非猜测。
  const notATextModel =
    lower.includes('embedding') || lower.includes('rerank');
  const tools: CapabilityState =
    stored.tools ??
    exact?.tools ??
    (notATextModel
      ? false
      : fromList(rawFeats.has('function-calling'), hasFeatList));

  const reasoning: CapabilityState =
    stored.reasoning ??
    exact?.reasoning ??
    (reasoningJson ? true : fromList(rawCaps.has('Reasoning'), hasCapList));

  const asr: CapabilityState =
    stored.asr ??
    exact?.asr ??
    fromList(rawCaps.has('ASR') || rawCaps.has('Realtime-ASR'), hasCapList);

  const tts: CapabilityState =
    stored.tts ??
    exact?.tts ??
    fromList(
      rawCaps.has('TTS') || rawCaps.has('Realtime-Text-to-Speech'),
      hasCapList,
    );

  const web_search: CapabilityState =
    stored.web_search ??
    exact?.webSearch ??
    fromList(rawFeats.has('web-search'), hasFeatList);

  // 模型名里的 "code" 噪声太大（codex、qwen3-coder、code-davinci 都会命中），
  // 没有官方字段就判为未知。
  const code: CapabilityState = stored.code ?? exact?.code;

  return { vision, tools, reasoning, asr, tts, web_search, code };
}

/**
 * 供 UI 使用的能力徽标。只渲染**确定支持**的能力：
 * 未知与不支持都不出现，避免把推测显示成结论。
 */
export function resolveModelCapabilities(
  modelId: string,
  capabilitiesJson?: string | null,
  reasoningJson?: string | null,
): ModelCapabilityTag[] {
  const states = resolveModelCapabilityStates(
    modelId,
    capabilitiesJson,
    reasoningJson,
  );
  return (Object.keys(TAG_META) as CapabilityId[])
    .filter((id) => states[id] === true)
    .map((id) => ({ id, ...TAG_META[id] }));
}
