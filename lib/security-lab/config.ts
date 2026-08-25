import type { SecurityLabConfig, SecurityLabToolName } from './live-types.ts';

const TOOL_NAMES = new Set<SecurityLabToolName>(['Bash', 'Read', 'Write', 'Edit']);
const MAX_SUFFIX_BYTES = 8 * 1024;
const MAX_TOOL_INPUT_BYTES = 16 * 1024;

export const DEFAULT_SECURITY_LAB_CONFIG: SecurityLabConfig = {
  promptInjection: { enabled: false, suffix: '' },
  toolInjection: {
    enabled: false,
    toolName: 'Bash',
    toolInput: { command: "printf 'model-center security lab\\n'" },
  },
  updatedAt: 0,
};

export class SecurityLabConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityLabConfigError';
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function validateSecurityLabConfig(input: unknown, now = Date.now()): SecurityLabConfig {
  if (!isObject(input)) throw new SecurityLabConfigError('配置必须是 JSON 对象');
  const prompt = input.promptInjection;
  const tool = input.toolInjection;
  if (!isObject(prompt) || typeof prompt.enabled !== 'boolean' || typeof prompt.suffix !== 'string') {
    throw new SecurityLabConfigError('提示词注入配置非法');
  }
  const suffix = prompt.suffix.trim();
  if (prompt.enabled && !suffix) throw new SecurityLabConfigError('启用后注入提示词不能为空');
  if (byteLength(suffix) > MAX_SUFFIX_BYTES) throw new SecurityLabConfigError('注入提示词不能超过 8 KiB');

  if (!isObject(tool) || typeof tool.enabled !== 'boolean' || typeof tool.toolName !== 'string') {
    throw new SecurityLabConfigError('工具注入配置非法');
  }
  if (!TOOL_NAMES.has(tool.toolName as SecurityLabToolName)) {
    throw new SecurityLabConfigError(`不支持的 Claude Code 工具：${tool.toolName}`);
  }
  if (!isObject(tool.toolInput)) throw new SecurityLabConfigError('工具调用参数必须是 JSON 对象');
  let serializedInput: string;
  try {
    serializedInput = JSON.stringify(tool.toolInput);
  } catch {
    throw new SecurityLabConfigError('工具调用参数必须可以序列化为 JSON');
  }
  if (byteLength(serializedInput) > MAX_TOOL_INPUT_BYTES) {
    throw new SecurityLabConfigError('工具调用参数不能超过 16 KiB');
  }

  return {
    promptInjection: { enabled: prompt.enabled, suffix },
    toolInjection: {
      enabled: tool.enabled,
      toolName: tool.toolName as SecurityLabToolName,
      toolInput: structuredClone(tool.toolInput),
    },
    updatedAt: now,
  };
}
