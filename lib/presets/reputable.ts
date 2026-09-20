/**
 * 国内外正规大模型厂商及知名算力平台白名单。
 * 用于过滤去除第三方杂牌中转站、拼车站及二道贩子。
 */

export const REPUTABLE_PRESET_SLUGS = new Set([
  // 1. 海外头部官方与大厂
  'claude-official',
  'codex',
  'gemini-native',
  'xai-grok',
  'azure-openai',
  'aws-bedrock-aksk',
  'aws-bedrock-api-key',
  'github-copilot',
  'nous-research',

  // 2. 国内主流大模型官方
  'deepseek',
  'kimi',
  'kimi-for-coding',
  'bailian',
  'bailian-for-coding',
  'zhipu-glm',
  'zhipu-glm-en',
  'agent-plan', // 火山 Agent Plan
  'coding-plan', // 火山 Coding Plan
  'doubaoseed', // 字节豆包
  'byteplus', // 字节海外
  'minimax',
  'minimax-en',
  'baidu-qianfan-coding-plan',
  'baidu-qianfan-token-plan',
  'tencent-hunyuan',
  'stepfun',
  'stepfun-en',
  'xiaomi-mimo',
  'xiaomi-mimo-token-plan-china',
  'modelscope', // 阿里魔搭
  'longcat',
  'bailing',
  'kat-coder',

  // 3. 知名正规聚合/开发者算力平台
  'siliconflow',
  'siliconflow-en',
  'openrouter',
  'together-ai',
  'nvidia',
  'novita-ai',
  'ppio-cc-switch',
]);

export function isReputablePreset(preset: { slug: string; presetKey?: string }): boolean {
  return (
    REPUTABLE_PRESET_SLUGS.has(preset.slug) ||
    (preset.presetKey ? REPUTABLE_PRESET_SLUGS.has(preset.presetKey) : false)
  );
}
