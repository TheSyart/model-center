const BAILIAN_PRESET_KEY = 'bailian';
const BAILIAN_SLUGS = new Set([
  'bailian',
  'bailian-openai',
  'qwen-coder-openai',
  'bailian-responses',
  'bailian-anthropic',
]);

export interface BailianCatalogProviderIdentity {
  slug: string;
  presetKey?: string | null;
}

export function isOfficialBailianCatalogProvider(provider: BailianCatalogProviderIdentity): boolean {
  return provider.presetKey === BAILIAN_PRESET_KEY || BAILIAN_SLUGS.has(provider.slug);
}

/** A workspace ID is interpolated into a DNS label, so dots, slashes and empty labels are rejected. */
export function normalizeBailianWorkspaceId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new Error('百炼 Workspace ID 必须是字符串');
  const workspaceId = value.trim();
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(workspaceId)) {
    throw new Error('百炼 Workspace ID 格式无效');
  }
  return workspaceId;
}

export interface BailianCatalogFilterOptions {
  /** 按模型供应商筛选，如 qwen, deepseek, zhipu-ai, mini-max 等 */
  providers?: string[];
  /** 按模型类型筛选，如 TG (文本), Reasoning (思考), ASR (语音识别), TTS (语音合成), VU (视觉理解) 等 */
  capabilities?: string[];
  /** 按模型能力筛选，如 function-calling, web-search 等 */
  features?: string[];
  /** 按推理服务供应商筛选，如 aliyun-bailian, siliconflow 等 */
  inference_providers?: string[];
  /** 按应用场景筛选，默认 inference */
  supports?: string[];
  /** 按部署模式筛选，如 global, asia-pacific-china 等 */
  service_site?: string;
  /** 按模型名称模糊搜索 */
  name?: string;
  /** 按模型 ID 精确查询 */
  model?: string;
  /** 返回语言，zh-CN 或 en-US */
  language?: string;
}

export const BAILIAN_PROVIDERS = [
  { id: 'qwen', label: '通义千问 (Qwen)' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'zhipu-ai', label: '智谱 AI' },
  { id: 'mini-max', label: 'MiniMax' },
  { id: 'moonshot-ai', label: '月之暗面 (Moonshot)' },
  { id: 'wan', label: '通义万相 (Wan)' },
  { id: 'kling', label: '快手可灵 (Kling)' },
  { id: 'pixverse', label: 'PixVerse' },
  { id: 'vidu', label: 'Vidu' },
  { id: 'tripo', label: 'Tripo' },
  { id: 'xiaomi', label: '小米 (MiMo)' },
  { id: 'qwen-domain-model', label: '阿里领域模型' },
  { id: 'happyhorse', label: 'HappyHorse' },
] as const;

export const BAILIAN_CAPABILITIES = [
  { id: 'TG', label: '文本生成 (TG)' },
  { id: 'Reasoning', label: '深度思考 (Reasoning)' },
  { id: 'VU', label: '视觉理解 (VU)' },
  { id: 'ASR', label: '语音识别 (ASR)' },
  { id: 'TTS', label: '语音合成 (TTS)' },
  { id: 'IG', label: '图像生成 (IG)' },
  { id: 'VG', label: '视频生成 (VG)' },
  { id: 'ME', label: '多模态向量 (ME)' },
  { id: 'TR', label: '文本向量 (TR)' },
] as const;

export function bailianCatalogUrl(
  workspaceId: unknown,
  page: number,
  pageSize: number,
  filter?: BailianCatalogFilterOptions,
): string {
  const normalized = normalizeBailianWorkspaceId(workspaceId);
  if (!normalized) throw new Error('百炼模型同步需要先配置 Workspace ID');
  const url = new URL(`https://${normalized}.cn-beijing.maas.aliyuncs.com/api/v1/models`);
  url.searchParams.set('page_no', String(page));
  url.searchParams.set('page_size', String(pageSize));

  if (filter) {
    if (filter.name) url.searchParams.set('name', filter.name.trim());
    if (filter.model) url.searchParams.set('model', filter.model.trim());
    if (filter.language) url.searchParams.set('language', filter.language.trim());
    if (filter.service_site) url.searchParams.set('service_site', filter.service_site.trim());

    const appendArray = (key: string, values?: string[]) => {
      if (Array.isArray(values)) {
        for (const item of values) {
          if (typeof item === 'string' && item.trim()) {
            url.searchParams.append(key, item.trim());
          }
        }
      }
    };

    appendArray('providers', filter.providers);
    appendArray('capabilities', filter.capabilities);
    appendArray('features', filter.features);
    appendArray('inference_providers', filter.inference_providers);
    appendArray('supports', filter.supports);
  }

  return url.toString();
}
