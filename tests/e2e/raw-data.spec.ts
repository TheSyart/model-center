import { expect, type APIRequestContext, test } from '@playwright/test';

interface GatewayFixture {
  key: string;
  model: string;
}

interface RawCaptureRecord {
  id: string;
  path: string;
}

interface RawCapturePage {
  items: RawCaptureRecord[];
  total: number;
}

async function createGatewayFixture(request: APIRequestContext): Promise<GatewayFixture> {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const slug = `raw-data-${suffix}`.toLowerCase();
  const providerResponse = await request.post('/api/admin/providers', {
    data: {
      slug,
      name: `Raw Data ${suffix}`,
      protocol: 'anthropic',
      base_url: 'http://127.0.0.1:4001',
      api_key: 'mock-anthropic-key',
      enabled: true,
    },
  });
  expect(providerResponse.ok(), await providerResponse.text()).toBeTruthy();

  const tokenResponse = await request.post('/api/admin/tokens', {
    data: { name: `raw-data-${suffix}` },
  });
  expect(tokenResponse.ok(), await tokenResponse.text()).toBeTruthy();
  const token = await tokenResponse.json() as { key: string };
  return { model: `${slug}/claude-demo`, key: token.key };
}

async function listRecords(request: APIRequestContext): Promise<RawCapturePage> {
  const response = await request.get('/api/admin/raw-data/records?page=1&page_size=100');
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<RawCapturePage>;
}

async function setCaptureEnabled(request: APIRequestContext, enabled: boolean): Promise<void> {
  const response = await request.put('/api/admin/raw-data/config', { data: { enabled } });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function sendAllFourRawRequests(
  request: APIRequestContext,
  fixture: GatewayFixture,
  marker: string,
): Promise<Map<string, Buffer>> {
  const rawBodies = new Map<string, string>([
    ['/v1/messages', JSON.stringify({
      model: fixture.model,
      max_tokens: 64,
      messages: [{ role: 'user', content: marker }],
    }) + '\n'],
    ['/v1/chat/completions', '{  "model":' + JSON.stringify(fixture.model)
      + ', "messages":[{"role":"user","content":' + JSON.stringify(marker) + '}] }\n'],
    ['/v1/responses', JSON.stringify({ model: fixture.model, input: marker }) + '\n'],
    ['/security-lab/v1/messages', JSON.stringify({
      model: fixture.model,
      max_tokens: 64,
      messages: [{ role: 'user', content: marker }],
    }) + '\n'],
  ]);

  const headers = {
    'content-type': 'application/json',
    'x-api-key': fixture.key,
    'anthropic-version': '2023-06-01',
    'user-agent': 'claude-cli/2.1.0',
  };
  for (const [path, body] of rawBodies) {
    const response = await request.fetch(path, { method: 'POST', headers, data: body });
    expect(response.ok(), `${path}: ${await response.text()}`).toBeTruthy();
    await response.body();
  }

  return new Map([...rawBodies].map(([path, body]) => [path, Buffer.from(body)]));
}

async function pollForNewRecords(
  request: APIRequestContext,
  baselineIds: Set<string>,
  baselineTotal: number,
  expectedCount: number,
): Promise<RawCaptureRecord[]> {
  let newRecords: RawCaptureRecord[] = [];
  await expect.poll(async () => {
    const page = await listRecords(request);
    newRecords = page.items.filter((record) => !baselineIds.has(record.id));
    return { total: page.total, newCount: newRecords.length };
  }, { timeout: 7_500 }).toEqual({
    total: baselineTotal + expectedCount,
    newCount: expectedCount,
  });
  return newRecords;
}

async function expectDownloadedBodiesToEqual(
  request: APIRequestContext,
  records: RawCaptureRecord[],
  expectedBodies: Map<string, Buffer>,
): Promise<void> {
  for (const record of records) {
    const expected = expectedBodies.get(record.path);
    expect(expected, `unexpected captured path ${record.path}`).toBeDefined();
    const response = await request.get(`/api/admin/raw-data/records/${record.id}/request?download=1`);
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(await response.body()).toEqual(expected);
  }
}

test('manual switch controls exact capture across every model entrypoint', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  const fixture = await createGatewayFixture(request);

  await setCaptureEnabled(request, false);
  const baseline = await listRecords(request);
  const baselineIds = new Set(baseline.items.map((record) => record.id));
  await sendAllFourRawRequests(request, fixture, `disabled-marker-${Date.now()}`);
  expect((await listRecords(request)).total).toBe(baseline.total);

  await setCaptureEnabled(request, true);
  const bodies = await sendAllFourRawRequests(request, fixture, `raw-marker-${Date.now()}`);
  const records = await pollForNewRecords(request, baselineIds, baseline.total, 4);
  expect(new Set(records.map((record) => record.path))).toEqual(new Set([
    '/v1/messages',
    '/v1/chat/completions',
    '/v1/responses',
    '/security-lab/v1/messages',
  ]));
  await expectDownloadedBodiesToEqual(request, records, bodies);
});
