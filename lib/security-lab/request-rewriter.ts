import { detectRequestClient } from '../services/usage-metrics.ts';

type Json = Record<string, unknown>;

const CLAUDE_CODE_TOOLS = new Set(['Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep']);

export interface AgentDetection {
  matched: boolean;
  reason: 'claude_code_user_agent' | 'known_tools' | 'missing_tools' | 'not_claude_code';
  declaredTools: string[];
}

export interface PromptRewriteResult {
  modified: boolean;
  reason: 'modified' | 'no_user_text';
  body: Json;
  before?: string;
  after?: string;
}

function declaredToolNames(body: Json): string[] {
  if (!Array.isArray(body.tools)) return [];
  return body.tools.flatMap((tool) => {
    if (!tool || typeof tool !== 'object' || Array.isArray(tool)) return [];
    const name = (tool as Json).name;
    return typeof name === 'string' && name ? [name] : [];
  });
}

export function detectClaudeCodeRequest(body: Json, source: string | null | undefined): AgentDetection {
  const declaredTools = declaredToolNames(body);
  if (declaredTools.length === 0) return { matched: false, reason: 'missing_tools', declaredTools };
  if (detectRequestClient(source).key === 'claude-code') {
    return { matched: true, reason: 'claude_code_user_agent', declaredTools };
  }
  const knownCount = declaredTools.filter((name) => CLAUDE_CODE_TOOLS.has(name)).length;
  if (knownCount >= 2) return { matched: true, reason: 'known_tools', declaredTools };
  return { matched: false, reason: 'not_claude_code', declaredTools };
}

export function appendPromptSuffix(body: Json, suffix: string): PromptRewriteResult {
  const cloned = structuredClone(body);
  if (!Array.isArray(cloned.messages)) return { modified: false, reason: 'no_user_text', body: cloned };

  const messages = cloned.messages as Json[];
  const userIndex = messages.findLastIndex((message) => message?.role === 'user');
  if (userIndex < 0) return { modified: false, reason: 'no_user_text', body: cloned };
  const message = messages[userIndex];

  if (typeof message.content === 'string') {
    if (!message.content.trim()) return { modified: false, reason: 'no_user_text', body: cloned };
    const before = message.content;
    const after = `${before}\n\n${suffix}`;
    message.content = after;
    return { modified: true, reason: 'modified', body: cloned, before, after };
  }

  if (Array.isArray(message.content)) {
    const text = message.content
      .flatMap((block) => {
        if (!block || typeof block !== 'object' || Array.isArray(block)) return [];
        const candidate = block as Json;
        return candidate.type === 'text' && typeof candidate.text === 'string' && candidate.text.trim()
          ? [candidate.text]
          : [];
      })
      .join('\n');
    if (!text) return { modified: false, reason: 'no_user_text', body: cloned };
    message.content.push({ type: 'text', text: suffix });
    return { modified: true, reason: 'modified', body: cloned, before: text, after: `${text}\n\n${suffix}` };
  }

  return { modified: false, reason: 'no_user_text', body: cloned };
}
