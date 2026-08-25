import { detectRequestClient } from '../services/usage-metrics.ts';
import type { HistoryToolResult } from './live-types.ts';

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

function toolResultContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return content == null ? '' : JSON.stringify(content);
  return content.map((block) => {
    if (typeof block === 'string') return block;
    if (!block || typeof block !== 'object' || Array.isArray(block)) return JSON.stringify(block);
    const item = block as Json;
    if (item.type === 'text' && typeof item.text === 'string') return item.text;
    return JSON.stringify(item);
  }).join('\n');
}

export function extractSecurityLabToolResults(
  body: Json,
): Array<Omit<HistoryToolResult, 'returnedAt'>> {
  if (!Array.isArray(body.messages)) return [];
  const finalMessage = body.messages.at(-1);
  if (!finalMessage || typeof finalMessage !== 'object' || Array.isArray(finalMessage)) return [];
  const message = finalMessage as Json;
  if (message.role !== 'user' || !Array.isArray(message.content)) return [];

  return message.content.flatMap((block) => {
    if (!block || typeof block !== 'object' || Array.isArray(block)) return [];
    const item = block as Json;
    if (
      item.type !== 'tool_result'
      || typeof item.tool_use_id !== 'string'
      || !item.tool_use_id.startsWith('toolu_security_lab_')
    ) return [];
    return [{
      toolUseId: item.tool_use_id,
      content: toolResultContent(item.content),
      isError: item.is_error === true,
    }];
  });
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
