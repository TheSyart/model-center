import { expect, it } from 'vitest';
import { openaiAdapter } from '@/lib/adapters/openai';
import { anthropicRequestToIR, irRequestToAnthropic } from '@/lib/protocols/anthropic';
import { geminiResponseToIR, irRequestToGemini } from '@/lib/protocols/gemini';
import { irRequestToResponses, responsesRequestToIR } from '@/lib/protocols/responses';

const ir = { messages: [{ role: 'user', content: 'hi' }], temperature: 0.4, max_tokens: 1024 };

it('Anthropic output carries adaptive thinking and drops sampling the model rejects', () => {
  const out = irRequestToAnthropic(ir, 'claude-opus-4-7', { mode: 'effort', effort: 'high' });
  expect(out.thinking).toEqual({ type: 'adaptive' });
  expect(out.output_config).toEqual({ effort: 'high' });
  expect(out.temperature).toBeUndefined();
  const unchanged = irRequestToAnthropic(ir, 'claude-sonnet-4-6');
  expect(unchanged.temperature).toBe(0.4);
  expect(unchanged.thinking).toBeUndefined();
});

it('Responses output carries reasoning.effort, and reasoning input items no longer become user messages', () => {
  expect(irRequestToResponses(ir, 'gpt-5.5', { mode: 'budget', budget: 2000 }).reasoning).toEqual({ effort: 'medium' });
  const back = responsesRequestToIR({
    input: [
      { type: 'reasoning', id: 'rs_1', summary: [] },
      { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'hi' }] },
    ],
  });
  expect(back.messages).toEqual([{ role: 'user', content: 'hi' }]);
});

it('Gemini output carries thinkingConfig, and thought parts stay out of the answer', () => {
  expect(
    irRequestToGemini(ir, { reasoning: { mode: 'effort', effort: 'low' }, modelId: 'gemini-3-flash' }).generationConfig
  ).toEqual({ temperature: 0.4, maxOutputTokens: 1024, thinkingConfig: { thinkingLevel: 'low' } });
  const res = geminiResponseToIR(
    { candidates: [{ content: { parts: [{ text: 'planning', thought: true }, { text: 'answer' }] }, finishReason: 'STOP' }] },
    'gemini-3-flash'
  );
  expect(res.choices[0].message.content).toBe('answer');
});

it('Anthropic thinking budgets survive conversion into a chat upstream as reasoning_effort', () => {
  const adapted = openaiAdapter.buildRequest(
    anthropicRequestToIR({ model: 'x', max_tokens: 100, messages: [{ role: 'user', content: 'hi' }] }),
    {
      provider: { baseUrl: 'https://upstream.example/v1' } as never,
      apiKey: 'key',
      modelId: 'gpt-5.5',
      stream: false,
      includeUsage: false,
      reasoning: { mode: 'budget', budget: 30000 },
    }
  );
  expect((adapted.body as Record<string, unknown>).reasoning_effort).toBe('xhigh');
});
