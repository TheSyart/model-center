/** 预设分类（cc-switch ProviderCategory 映射而来，供 UI 分组展示）。 */
export type PresetCategory = 'official' | 'cn_official' | 'cloud_provider' | 'aggregator' | 'third_party' | 'relay' | 'other';

export const CATEGORY_LABELS: Record<PresetCategory, string> = {
  official: '官方',
  cn_official: '国内官方',
  cloud_provider: '云服务商',
  aggregator: '聚合平台',
  third_party: '中转/第三方',
  relay: '中转/第三方',
  other: '其他',
};

export type ProviderProtocol = 'openai' | 'openai-responses' | 'anthropic' | 'gemini';

export interface ProviderPresetKnownModel {
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

export interface ProviderPresetEndpointCandidate {
  variantSlug: string;
  baseUrl: string;
  sourceApps: string[];
  supported: boolean;
  authMode: 'api-key' | 'oauth';
}

export interface ProviderPresetEndpoint {
  protocol: ProviderProtocol;
  baseUrl: string;
  selectedVariantSlug: string;
  sourceApps: string[];
  knownModels: ProviderPresetKnownModel[];
  modelCatalogComplete: false;
  alternateCandidates: ProviderPresetEndpointCandidate[];
}

export interface ProviderPreset {
  /** Stable logical-provider key; `slug` remains the canonical lookup alias. */
  presetKey: string;
  slug: string;
  name: string;
  /** Default-endpoint compatibility fields for existing consumers. */
  protocol: ProviderProtocol;
  baseUrl: string;
  defaultProtocol: ProviderProtocol;
  endpoints: ProviderPresetEndpoint[];
  /** Every historic CC Switch protocol/Base URL variant key for this provider. */
  legacySlugs: string[];
  category: PresetCategory;
  /** 厂商 logo 路径（public/logos/ 下），无则前端用首字母占位 */
  logo?: string;
  /** 模型列表接口（相对 base_url 的路径，仅供参考展示） */
  modelsEndpoint?: string;
  /** 余额查询信息（仅部分主流厂商内置） */
  balance?: {
    endpoint?: string;
    method?: string;
    supported: boolean;
    note?: string;
  };
  /** 官网 */
  websiteUrl?: string;
  /** 控制台 / 密钥管理页 */
  consoleUrl?: string;
  /** 主流推荐预设（legacy 13 家），UI 置顶并加标记 */
  recommended?: boolean;
  /** Coding Plan 套餐厂商标记（kimi/zhipu/minimax-cn/minimax-en/zenmux/volcengine），优先级高于 base_url 模式检测 */
  codingPlan?: string;
  /** false 表示上游有该预设，但当前网关不支持其鉴权或协议。 */
  supported?: boolean;
  disabledReason?: string;
  authMode?: 'api-key' | 'oauth';
  sourceApps?: string[];
  /**
   * cc-switch 预设的额外配置（仅保存展示，网关暂不消费）：
   * env（claude 系的模型默认值等）、endpoint_candidates、api_key_field、config_toml（codex 系）。
   */
  extra?: Record<string, unknown>;
}
