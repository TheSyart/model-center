/** CC Switch 固定源码中内置的余额查询供应商。 */
export type CcSwitchBalanceProvider =
  | 'deepseek'
  | 'stepfun'
  | 'siliconflow-cn'
  | 'siliconflow-en'
  | 'openrouter'
  | 'novita';

/**
 * 与 CC Switch `src-tauri/src/services/balance.rs::detect_provider` 同序匹配。
 * 依赖 Base URL 而非本项目 slug，因此同一厂商的 Claude/Codex/Gemini 变体均可查询。
 */
export function detectCcSwitchBalanceProvider(baseUrl: string): CcSwitchBalanceProvider | null {
  const url = baseUrl.toLowerCase();
  if (url.includes('api.deepseek.com')) return 'deepseek';
  if (url.includes('api.stepfun.ai') || url.includes('api.stepfun.com')) return 'stepfun';
  if (url.includes('api.siliconflow.cn')) return 'siliconflow-cn';
  if (url.includes('api.siliconflow.com')) return 'siliconflow-en';
  if (url.includes('openrouter.ai')) return 'openrouter';
  if (url.includes('api.novita.ai')) return 'novita';
  return null;
}
