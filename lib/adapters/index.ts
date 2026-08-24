import type { Protocol } from '@/lib/services/provider';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { openaiAdapter } from './openai';
import { responsesAdapter } from './responses';
import type { ProtocolAdapter } from './types';

/**
 * 协议 → 适配器注册表（§3.2）。
 * 四协议全部注册：openai / openai-responses / anthropic / gemini。
 */
const ADAPTERS: Partial<Record<Protocol, ProtocolAdapter>> = {
  openai: openaiAdapter,
  'openai-responses': responsesAdapter,
  anthropic: anthropicAdapter,
  gemini: geminiAdapter,
};

export function getAdapter(protocol: string): ProtocolAdapter | undefined {
  return ADAPTERS[protocol as Protocol];
}
