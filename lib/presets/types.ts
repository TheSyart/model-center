/** 预设分类（cc-switch ProviderCategory 映射而来，供 UI 分组展示）。 */
export type PresetCategory = 'official' | 'cn_official' | 'aggregator' | 'relay' | 'other';

export const CATEGORY_LABELS: Record<PresetCategory, string> = {
  official: '官方',
  cn_official: '国内官方',
  aggregator: '聚合平台',
  relay: '中转/第三方',
  other: '其他',
};

export interface ProviderPreset {
  slug: string;
  name: string;
  protocol: 'openai' | 'openai-responses' | 'anthropic' | 'gemini';
  baseUrl: string;
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
  /**
   * cc-switch 预设的额外配置（仅保存展示，网关暂不消费）：
   * env（claude 系的模型默认值等）、endpoint_candidates、api_key_field、config_toml（codex 系）。
   */
  extra?: Record<string, unknown>;
}
