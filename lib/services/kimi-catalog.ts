import { isReasoningEffort, type ModelReasoning, type ReasoningEffort } from '../gateway/reasoning.ts';

/**
 * Kimi / 月之暗面模型目录。
 *
 * `GET {base}/models` 在平台站与 Coding 套餐站返回同一套结构，两者可以共用一个解析器；
 * Coding 站额外多出 `-highspeed` 变体，这些变体在响应里是独立条目、自带能力字段，
 * 不需要靠剥后缀去继承基础模型。
 *
 * 文档：https://platform.kimi.com/docs/api/list-models
 * 实测：2026-09-19，api.kimi.com/coding/v1/models 返回的字段比文档更多
 * （多出 supports_dynamic_tools 与 think_efforts）。
 *
 * 按 Base URL 判定而非 slug —— 同一厂商可能配出多个服务商条目。
 */
const KIMI_HOSTS = ['api.moonshot.cn', 'api.moonshot.ai', 'api.kimi.com', 'api.kimi.ai'];

export function isKimiCatalogProvider(provider: { baseUrl?: string | null }): boolean {
  const base = provider.baseUrl?.trim().toLowerCase();
  if (!base) return false;
  let host: string;
  try {
    host = new URL(base).hostname;
  } catch {
    return false;
  }
  return KIMI_HOSTS.includes(host);
}

export interface KimiModelRecord {
  id: string;
  displayName: string | null;
  contextWindow: number | null;
  capabilitiesJson: string | null;
  reasoningJson: string | null;
}

const text = (value: unknown, max = 256): string | null =>
  typeof value === 'string' && value.trim() && value.length <= max ? value.trim() : null;

const flag = (value: unknown): boolean | undefined =>
  typeof value === 'boolean' ? value : undefined;

const positiveInt = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

/** think_efforts → 项目既有的 ModelReasoning。缺字段或档位非法时返回 null，不编造。 */
function parseThinkEfforts(raw: unknown): ModelReasoning | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const think = raw as Record<string, unknown>;
  if (think.support !== true) return null;
  const valid = Array.isArray(think.valid_efforts) ? think.valid_efforts : [];
  const efforts = valid.filter(isReasoningEffort);
  // 上游给了档位却一个都识别不了，说明枚举对不上，宁可不写也不要塞半套进去。
  if (valid.length > 0 && efforts.length !== valid.length) return null;
  if (efforts.length === 0) return null;
  const fallback = think.default_effort;
  return {
    efforts: efforts as ReasoningEffort[],
    ...(isReasoningEffort(fallback) ? { defaultEffort: fallback } : {}),
    control: 'level',
  };
}

export function parseKimiModelPage(json: unknown): KimiModelRecord[] {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error('Kimi 模型列表响应必须是 JSON 对象');
  }
  const body = json as Record<string, unknown>;
  if (!Array.isArray(body.data)) throw new Error('Kimi 模型列表缺少 data 数组');

  return body.data.map((item, index): KimiModelRecord => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(`Kimi data[${index}] 必须是对象`);
    }
    const row = item as Record<string, unknown>;
    const id = text(row.id, 200);
    if (!id) throw new Error(`Kimi data[${index}] 缺少有效模型 ID`);

    const vision = flag(row.supports_image_in);
    const video = flag(row.supports_video_in);
    const tools = flag(row.supports_dynamic_tools);
    const reasoning = flag(row.supports_reasoning);

    // 本项目的能力位里没有「视频输入」，用模态列表承载，不硬塞进 vision。
    const modalities = ['Text'];
    if (vision) modalities.push('Image');
    if (video) modalities.push('Video');

    const capabilities: Record<string, unknown> = {
      modalities,
      // 保留上游原值，便于以后对照官方字段变化
      rawKimiFlags: {
        supports_image_in: row.supports_image_in ?? null,
        supports_video_in: row.supports_video_in ?? null,
        supports_dynamic_tools: row.supports_dynamic_tools ?? null,
        supports_reasoning: row.supports_reasoning ?? null,
        supports_thinking_type: row.supports_thinking_type ?? null,
      },
    };
    // 只写上游明确给了布尔值的位；没给就留空，交给「未知」而不是判成不支持。
    if (vision !== undefined) capabilities.vision = vision;
    if (tools !== undefined) capabilities.tools = tools;
    if (reasoning !== undefined) capabilities.reasoning = reasoning;

    const meta = parseThinkEfforts(row.think_efforts);

    return {
      id,
      displayName: text(row.display_name),
      contextWindow: positiveInt(row.context_length),
      capabilitiesJson: JSON.stringify(capabilities),
      reasoningJson: meta ? JSON.stringify(meta) : null,
    };
  });
}
