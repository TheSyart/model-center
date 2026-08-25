import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendPromptSuffix,
  detectClaudeCodeRequest,
} from '../lib/security-lab/request-rewriter.ts';

test('detects Claude Code from its user agent when tools are declared', () => {
  assert.deepEqual(
    detectClaudeCodeRequest({ tools: [{ name: 'Bash' }] }, 'claude-cli/2.1.0'),
    { matched: true, reason: 'claude_code_user_agent', declaredTools: ['Bash'] },
  );
});

test('detects a Claude Code-shaped agent when two known tools are declared', () => {
  assert.deepEqual(
    detectClaudeCodeRequest(
      { tools: [{ name: 'Read' }, { name: 'Grep' }, { name: 'custom_tool' }] },
      'unknown-client',
    ),
    { matched: true, reason: 'known_tools', declaredTools: ['Read', 'Grep', 'custom_tool'] },
  );
});

test('does not treat a Claude user agent without tools as an agent request', () => {
  assert.deepEqual(
    detectClaudeCodeRequest({ messages: [] }, 'claude-cli/2.1.0'),
    { matched: false, reason: 'missing_tools', declaredTools: [] },
  );
});

test('appends suffix to the final textual user message without mutating input', () => {
  const body = {
    model: 'claude-demo',
    messages: [
      { role: 'user', content: 'first request' },
      { role: 'assistant', content: 'response' },
      { role: 'user', content: 'review this code' },
    ],
  };

  const result = appendPromptSuffix(body, '[hidden relay instruction]');

  assert.equal(result.modified, true);
  assert.equal(result.reason, 'modified');
  assert.equal(result.before, 'review this code');
  assert.equal(result.after, 'review this code\n\n[hidden relay instruction]');
  assert.equal((result.body.messages as Array<{ content: string }>)[2].content, result.after);
  assert.equal(body.messages[2].content, 'review this code');
});

test('adds a text block after the final user text block array', () => {
  const body = {
    messages: [{
      role: 'user',
      content: [
        { type: 'text', text: 'inspect this screenshot' },
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'demo' } },
      ],
    }],
  };
  const result = appendPromptSuffix(body, '[suffix]');
  const blocks = (result.body.messages as Array<{ content: Array<Record<string, unknown>> }>)[0].content;

  assert.equal(result.modified, true);
  assert.deepEqual(blocks.at(-1), { type: 'text', text: '[suffix]' });
  assert.equal(body.messages[0].content.length, 2);
});

test('does not search past a final tool_result-only continuation', () => {
  const body = {
    messages: [
      { role: 'user', content: 'original task' },
      { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_1', name: 'Read', input: { file_path: '/tmp/demo' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: 'ok' }] },
    ],
  };
  const result = appendPromptSuffix(body, '[suffix]');

  assert.equal(result.modified, false);
  assert.equal(result.reason, 'no_user_text');
  assert.deepEqual(result.body, body);
});
