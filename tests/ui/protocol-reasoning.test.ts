import { expect, it } from 'vitest';
import { openaiAdapter } from '@/lib/adapters/openai';
import { anthropicRequestToIR, irRequestToAnthropic } from '@/lib/protocols/anthropic';
import { geminiResponseToIR, geminiStreamToIR, irRequestToGemini } from '@/lib/protocols/gemini';
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

it('Gemini tool thought signatures survive a JSON Chat round trip', () => {
  const response = geminiResponseToIR(
    {
      candidates: [
        {
          content: {
            parts: [
              {
                thoughtSignature: 'provider-signature-json',
                functionCall: { id: 'provider-call-1', name: 'echo', args: { text: 'hello' } },
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    },
    'gemini-3.8-flash'
  );
  const assistant = response.choices[0].message;
  expect(assistant.tool_calls[0]).toMatchObject({
    id: 'provider-call-1',
    extra_content: { google: { thought_signature: 'provider-signature-json' } },
  });
  expect(assistant.reasoning_details).toEqual([
    { type: 'reasoning.encrypted', id: 'provider-call-1', data: 'provider-signature-json' },
  ]);

  const replay = irRequestToGemini({
    messages: [
      { role: 'user', content: 'use echo' },
      assistant,
      { role: 'tool', tool_call_id: 'provider-call-1', content: 'hello' },
    ],
  });
  expect(replay.contents[1].parts[0]).toEqual({
    thoughtSignature: 'provider-signature-json',
    functionCall: { name: 'echo', args: { text: 'hello' } },
  });
});

it('Gemini tool thought signatures survive streamed Chat reasoning_details replay', async () => {
  const native = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        new TextEncoder().encode(
          `data: ${JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      thoughtSignature: 'provider-signature-stream',
                      functionCall: { id: 'provider-call-2', name: 'read_file', args: { path: '/tmp/a' } },
                    },
                  ],
                },
                finishReason: 'STOP',
              },
            ],
          })}\n\n`
        )
      );
      controller.close();
    },
  });
  const translated = geminiStreamToIR(native, { model: 'gemini-3.8-flash', includeUsage: false });
  const wire = await new Response(translated.stream).text();
  const events = wire
    .split('\n\n')
    .filter((event) => event.startsWith('data: {'))
    .map((event) => JSON.parse(event.slice(6)));
  const delta = events.map((event) => event.choices?.[0]?.delta).find((value) => value?.tool_calls);
  expect(delta.tool_calls[0]).toMatchObject({
    id: 'provider-call-2',
    extra_content: { google: { thought_signature: 'provider-signature-stream' } },
  });
  expect(delta.reasoning_details).toEqual([
    { type: 'reasoning.encrypted', id: 'provider-call-2', data: 'provider-signature-stream' },
  ]);

  // pi-ai keeps reasoning_details but strips non-standard tool-call fields before replay.
  const replay = irRequestToGemini({
    messages: [
      { role: 'user', content: 'read file' },
      {
        role: 'assistant',
        content: null,
        tool_calls: delta.tool_calls.map(({ extra_content: _ignored, ...call }: Record<string, unknown>) => call),
        reasoning_details: delta.reasoning_details,
      },
      { role: 'tool', tool_call_id: 'provider-call-2', content: 'contents' },
    ],
  });
  expect(replay.contents[1].parts[0].thoughtSignature).toBe('provider-signature-stream');
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
