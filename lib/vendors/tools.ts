/**
 * 服务商工具服务目录（人工整理，非生成内容）。
 *
 * 官方都没有「列出我有哪些工具」的查询接口，这份目录只能照官方文档手工维护，
 * 因此每条都带 docUrl 与 verifiedAt，方便下次核对。**价格未公布的一律标 unknown，
 * 不许用同类产品推测填数。**
 *
 * 两类调用方式必须分清，不能混为一谈：
 *   - endpoint：独立的 REST 接口，调用时不传 model，与推理请求无关
 *   - inline：随推理请求下发，只在特定协议面（Responses / Anthropic / Chat）可用
 */

export type ToolSurface = 'openai-chat' | 'openai-responses' | 'anthropic';

export const SURFACE_LABELS: Record<ToolSurface, string> = {
  'openai-chat': 'Chat Completions',
  'openai-responses': 'Responses API',
  anthropic: 'Anthropic Messages',
};

export type ToolInvocation =
  | { kind: 'endpoint'; method: 'GET' | 'POST'; url: string }
  | { kind: 'inline'; surfaces: ToolSurface[] };

export type Currency = 'CNY' | 'USD';

export type ToolBilling =
  | { unit: 'per_call'; amount: number; currency: Currency }
  | { unit: 'per_thousand_calls'; amount: number; currency: Currency }
  | { unit: 'per_page'; amount: number; currency: Currency }
  | { unit: 'per_gb_day'; amount: number; currency: Currency; freeAllowance?: string }
  | { unit: 'per_container_hour'; amount: number; currency: Currency; freeAllowance?: string }
  | { unit: 'per_session'; amount: number; currency: Currency; detail: string }
  /** 只按 token 计费，工具本身不额外收费 */
  | { unit: 'token_only' }
  /** 官方标注限时免费 */
  | { unit: 'free_promo' }
  /** 官方未公布价格——不要猜 */
  | { unit: 'unknown' };

export interface ToolVariant {
  id: string;
  name: string;
  billing: ToolBilling;
}

export interface ProviderTool {
  id: string;
  name: string;
  description: string;
  invocation: ToolInvocation;
  billing: ToolBilling;
  /** 同一工具的多个档位（例如智谱四个搜索引擎） */
  variants?: ToolVariant[];
  /** 计费口径、密钥范围等需要说清楚的前提 */
  note?: string;
  docUrl: string;
}

export interface ProviderToolCatalog {
  vendor: string;
  /** 与 providers.preset_key / slug 匹配 */
  presetKeys: string[];
  /** 这些工具实际所在的主机；与推理 Base URL 可能不同 */
  host?: string;
  note?: string;
  verifiedAt: string;
  tools: ProviderTool[];
}

const KIMI_BILLING_NOTE = '仅在 HTTP 200 且返回结果非空时计费，失败或空结果不计费。';

export const PROVIDER_TOOL_CATALOGS: ProviderToolCatalog[] = [
  {
    vendor: 'Kimi（月之暗面）',
    presetKeys: ['kimi', 'kimi-for-coding'],
    host: 'https://api.moonshot.cn',
    note: 'Kimi 平台密钥与 Kimi For Coding 套餐密钥是两套凭据，国内站（platform.kimi.com）与国际站（platform.kimi.ai）也互不通用，混用会返回 401。',
    verifiedAt: '2026-09-19',
    tools: [
      {
        id: 'kimi-search',
        name: '联网搜索',
        description: '返回标题、摘要、正文与站点信息；include_content 可带正文。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://api.moonshot.cn/v1/tools/search' },
        billing: { unit: 'per_call', amount: 0.01, currency: 'CNY' },
        note: KIMI_BILLING_NOTE,
        docUrl: 'https://platform.kimi.com/docs/api/tools-search',
      },
      {
        id: 'kimi-search-pro',
        name: '联网搜索 Pro',
        description: '在基础搜索上增加站点过滤（最多 5 个域名）、时间窗口，并返回带相关度评分的文本分片。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://api.moonshot.cn/v1/tools/search_pro' },
        billing: { unit: 'per_call', amount: 0.015, currency: 'CNY' },
        note: KIMI_BILLING_NOTE,
        docUrl: 'https://platform.kimi.com/docs/api/tools-search-pro',
      },
      {
        id: 'kimi-fetch',
        name: '网页抓取',
        description: '抓取指定 URL 并返回 markdown 正文与标题，仅支持 http/https。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://api.moonshot.cn/v1/tools/fetch' },
        billing: { unit: 'per_call', amount: 0.01, currency: 'CNY' },
        note: '仅在 HTTP 200 且 markdown 非空白时计费；页面无正文内容不计费。',
        docUrl: 'https://platform.kimi.com/docs/api/tools-fetch',
      },
    ],
  },
  {
    vendor: '智谱 GLM',
    presetKeys: ['zhipu-glm', 'zhipu-glm-en'],
    host: 'https://open.bigmodel.cn/api/paas/v4',
    verifiedAt: '2026-09-19',
    tools: [
      {
        id: 'zhipu-web-search',
        name: '网络搜索',
        description: '面向大模型优化的搜索，带意图识别与结构化输出；四个引擎按档计价。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://open.bigmodel.cn/api/paas/v4/web_search' },
        billing: { unit: 'per_call', amount: 0.01, currency: 'CNY' },
        variants: [
          { id: 'search_std', name: '基础版（智谱自研）', billing: { unit: 'per_call', amount: 0.01, currency: 'CNY' } },
          { id: 'search_pro', name: '高级版（智谱自研）', billing: { unit: 'per_call', amount: 0.03, currency: 'CNY' } },
          { id: 'search_pro_sogou', name: '搜狗', billing: { unit: 'per_call', amount: 0.05, currency: 'CNY' } },
          { id: 'search_pro_quark', name: '夸克', billing: { unit: 'per_call', amount: 0.05, currency: 'CNY' } },
        ],
        docUrl: 'https://docs.bigmodel.cn/api-reference/工具-api/网络搜索',
      },
      {
        id: 'zhipu-reader',
        name: '网页阅读',
        description: '抓取网页并输出 markdown/text，可选保留图片、链接与图片摘要。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://open.bigmodel.cn/api/paas/v4/reader' },
        billing: { unit: 'unknown' },
        docUrl: 'https://docs.bigmodel.cn/api-reference/工具-api/网页阅读',
      },
      {
        id: 'zhipu-moderations',
        name: '内容安全',
        description: '文本/图片/视频/音频审核，返回 PASS / REVIEW / BLOCK / REJECT / HIGH 风险等级与风险类型。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://open.bigmodel.cn/api/paas/v4/moderations' },
        billing: { unit: 'unknown' },
        note: '文本上限 2000 字符；图片 ≤10MB。',
        docUrl: 'https://docs.bigmodel.cn/api-reference/工具-api/内容安全',
      },
      {
        id: 'zhipu-parser-sync',
        name: '文件解析（同步）',
        description: 'tool_type=prime-sync，直接返回解析内容，支持 28 种格式。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://open.bigmodel.cn/api/paas/v4/files/parser/sync' },
        billing: { unit: 'unknown' },
        docUrl: 'https://docs.bigmodel.cn/api-reference/工具-api/文件解析同步',
      },
      {
        id: 'zhipu-parser-async',
        name: '文件解析（异步）',
        description: '提交解析任务返回 task_id；tool_type 分 lite / expert / prime 三档，支持格式各不相同。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://open.bigmodel.cn/api/paas/v4/files/parser/create' },
        billing: { unit: 'unknown' },
        note: '需配合「解析结果」接口轮询取回。',
        docUrl: 'https://docs.bigmodel.cn/api-reference/工具-api/文件解析',
      },
      {
        id: 'zhipu-parser-result',
        name: '解析结果',
        description: '按 task_id 取回异步解析结果，format_type 可选 text 或 download_link。',
        invocation: { kind: 'endpoint', method: 'GET', url: 'https://open.bigmodel.cn/api/paas/v4/files/parser/result/{taskId}/{format_type}' },
        billing: { unit: 'token_only' },
        note: '结果查询本身不单独计费，费用计在对应的解析任务上。',
        docUrl: 'https://docs.bigmodel.cn/api-reference/工具-api/解析结果',
      },
      {
        id: 'zhipu-ocr',
        name: 'OCR 服务',
        description: '手写体识别（tool_type=hand_write），支持 25 种语言，可返回置信度。',
        invocation: { kind: 'endpoint', method: 'POST', url: 'https://open.bigmodel.cn/api/paas/v4/files/ocr' },
        billing: { unit: 'unknown' },
        docUrl: 'https://docs.bigmodel.cn/api-reference/工具-api/ocr-服务',
      },
    ],
  },
  {
    vendor: '阿里云百炼',
    presetKeys: ['bailian', 'bailian-for-coding'],
    note: '百炼的工具不是独立接口，需随推理请求在对应协议面下发；不同协议面支持的工具不同。',
    verifiedAt: '2026-09-18',
    tools: [
      {
        id: 'bailian-code-interpreter',
        name: 'Code Interpreter',
        description: '代码解释器。',
        invocation: { kind: 'inline', surfaces: ['openai-responses'] },
        billing: { unit: 'free_promo' },
        docUrl: 'https://help.aliyun.com/zh/model-studio/',
      },
      {
        id: 'bailian-web-extractor',
        name: 'Web Extractor',
        description: '网页内容抽取。',
        invocation: { kind: 'inline', surfaces: ['openai-responses'] },
        billing: { unit: 'free_promo' },
        docUrl: 'https://help.aliyun.com/zh/model-studio/web-extractor',
      },
      {
        id: 'bailian-web-search',
        name: 'Web Search',
        description: '联网搜索；Responses 与 Anthropic 两个面都提供，价格相同。',
        invocation: { kind: 'inline', surfaces: ['openai-responses', 'anthropic'] },
        billing: { unit: 'per_thousand_calls', amount: 4, currency: 'CNY' },
        docUrl: 'https://help.aliyun.com/zh/model-studio/',
      },
      {
        id: 'bailian-web-fetch',
        name: 'Web Fetch',
        description: '抓取指定网页。',
        invocation: { kind: 'inline', surfaces: ['anthropic'] },
        billing: { unit: 'free_promo' },
        docUrl: 'https://help.aliyun.com/zh/model-studio/',
      },
      {
        id: 'bailian-i2i-search',
        name: 'I2i Search',
        description: '以图搜图。',
        invocation: { kind: 'inline', surfaces: ['openai-responses'] },
        billing: { unit: 'per_thousand_calls', amount: 48, currency: 'CNY' },
        docUrl: 'https://help.aliyun.com/zh/model-studio/',
      },
      {
        id: 'bailian-t2i-search',
        name: 'T2i Search',
        description: '以文搜图。',
        invocation: { kind: 'inline', surfaces: ['openai-responses'] },
        billing: { unit: 'per_thousand_calls', amount: 24, currency: 'CNY' },
        docUrl: 'https://help.aliyun.com/zh/model-studio/',
      },
      {
        id: 'bailian-pdf-parsing',
        name: 'Pdf Parsing',
        description: 'PDF 解析；仅 Completions 面提供。',
        invocation: { kind: 'inline', surfaces: ['openai-chat'] },
        billing: { unit: 'per_page', amount: 0.02, currency: 'CNY' },
        note: '解析出的文字与图片另按模型输入 token 计价。',
        docUrl: 'https://help.aliyun.com/zh/model-studio/pdf-understanding',
      },
    ],
  },
  {
    vendor: 'MiniMax',
    presetKeys: ['minimax', 'minimax-en'],
    verifiedAt: '2026-09-18',
    tools: [
      {
        id: 'minimax-web-search',
        name: 'Web Search',
        description: '模型生成回复时自动联网检索，服务端自动执行，无需手工回传工具结果。',
        invocation: { kind: 'inline', surfaces: ['anthropic', 'openai-responses'] },
        billing: { unit: 'per_call', amount: 0.03, currency: 'CNY' },
        note: 'Anthropic 面声明为 {"type":"web_search_20250305"}，Responses 面为 {"type":"web_search"}。',
        docUrl: 'https://platform.minimax.cn/docs/guides/pricing-paygo',
      },
    ],
  },
];

/** 某服务商（按 preset_key 或 slug）的工具目录。 */
export function toolCatalogFor(preset: { presetKey?: string | null; slug?: string | null }): ProviderToolCatalog | null {
  const keys = [preset.presetKey, preset.slug].filter((k): k is string => !!k);
  return PROVIDER_TOOL_CATALOGS.find((c) => keys.some((k) => c.presetKeys.includes(k))) ?? null;
}

export function formatToolBilling(billing: ToolBilling): string {
  const symbol = (currency: Currency) => (currency === 'CNY' ? '¥' : '$');
  switch (billing.unit) {
    case 'per_call':
      return `${symbol(billing.currency)}${billing.amount} / 次`;
    case 'per_thousand_calls':
      return `${symbol(billing.currency)}${billing.amount} / 千次`;
    case 'per_page':
      return `${symbol(billing.currency)}${billing.amount} / 页`;
    case 'per_gb_day':
      return `${symbol(billing.currency)}${billing.amount} / GB·天${billing.freeAllowance ? `（${billing.freeAllowance}）` : ''}`;
    case 'per_container_hour':
      return `${symbol(billing.currency)}${billing.amount} / 容器·小时${billing.freeAllowance ? `（${billing.freeAllowance}）` : ''}`;
    case 'per_session':
      return `${symbol(billing.currency)}${billing.amount} · ${billing.detail}`;
    case 'token_only':
      return '不额外收费（仅计 token）';
    case 'free_promo':
      return '限时免费';
    case 'unknown':
      return '官方未公布';
  }
}
