type Json = Record<string, any>;

/** 网关扩展字段（消费后剥离，不转发上游） */
export const EXTENSION_FIELDS = ['prompt_id', 'prompt_name', 'prompt_vars', 'x-preset'] as const;

export interface PromptExtension {
  id?: string;
  name?: string;
  vars?: Record<string, unknown>;
}

/**
 * 从请求体提取预设提示词扩展字段（§7.1）：prompt_id（按 id）/ prompt_name（按 name）/ prompt_vars。
 * 调用后字段已从 body 删除。未携带则返回 undefined。
 */
export function extractPromptExtension(body: Json): PromptExtension | undefined {
  const prompt: PromptExtension = {};
  if (typeof body.prompt_id === 'string' && body.prompt_id) prompt.id = body.prompt_id;
  if (typeof body.prompt_name === 'string' && body.prompt_name) prompt.name = body.prompt_name;
  if (body.prompt_vars && typeof body.prompt_vars === 'object' && !Array.isArray(body.prompt_vars)) {
    prompt.vars = body.prompt_vars as Record<string, unknown>;
  }
  for (const field of EXTENSION_FIELDS) {
    delete body[field];
  }
  return prompt.id || prompt.name ? prompt : undefined;
}
