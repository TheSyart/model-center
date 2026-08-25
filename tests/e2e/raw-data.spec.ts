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
  page: number;
  pageSize: number;
}

const canonicalPaths = [
  '/v1/messages',
  '/v1/chat/completions',
  '/v1/responses',
  '/security-lab/v1/messages',
] as const;

type CanonicalPath = typeof canonicalPaths[number];

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

async function listRecords(request: APIRequestContext, page: number): Promise<RawCapturePage> {
  const response = await request.get(`/api/admin/raw-data/records?page=${page}&page_size=100`);
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<RawCapturePage>;
}

async function listAllRecords(request: APIRequestContext): Promise<RawCaptureRecord[]> {
  const records = new Map<string, RawCaptureRecord>();
  let pageNumber = 1;
  let requiredPages = 1;

  while (pageNumber <= requiredPages) {
    const page = await listRecords(request, pageNumber);
    for (const record of page.items) records.set(record.id, record);
    requiredPages = Math.max(requiredPages, Math.ceil(page.total / page.pageSize));
    pageNumber++;
  }

  return [...records.values()];
}

async function getCaptureEnabled(request: APIRequestContext): Promise<boolean> {
  const response = await request.get('/api/admin/raw-data/config');
  expect(response.ok(), await response.text()).toBeTruthy();
  const dashboard = await response.json() as { config: { enabled: boolean } };
  return dashboard.config.enabled;
}

async function setCaptureEnabled(request: APIRequestContext, enabled: boolean): Promise<void> {
  const response = await request.put('/api/admin/raw-data/config', { data: { enabled } });
  expect(response.ok(), await response.text()).toBeTruthy();
}

async function sendAllFourRawRequests(
  request: APIRequestContext,
  fixture: GatewayFixture,
  markerPrefix: string,
): Promise<Map<string, Buffer>> {
  const markers = new Map<CanonicalPath, string>([
    ['/v1/messages', `${markerPrefix}:anthropic-messages`],
    ['/v1/chat/completions', `${markerPrefix}:openai-chat-completions`],
    ['/v1/responses', `${markerPrefix}:openai-responses`],
    ['/security-lab/v1/messages', `${markerPrefix}:security-lab-anthropic`],
  ]);
  const rawBodies = new Map<string, string>([
    ['/v1/messages', JSON.stringify({
      model: fixture.model,
      max_tokens: 64,
      messages: [{ role: 'user', content: markers.get('/v1/messages') }],
    }) + '\n'],
    ['/v1/chat/completions', '{  "model":' + JSON.stringify(fixture.model)
      + ', "messages":[{"role":"user","content":'
      + JSON.stringify(markers.get('/v1/chat/completions')) + '}] }\n'],
    ['/v1/responses', JSON.stringify({
      model: fixture.model,
      input: markers.get('/v1/responses'),
    }) + '\n'],
    ['/security-lab/v1/messages', JSON.stringify({
      model: fixture.model,
      max_tokens: 64,
      messages: [{ role: 'user', content: markers.get('/security-lab/v1/messages') }],
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

function emptyMatches(): Map<CanonicalPath, RawCaptureRecord[]> {
  return new Map(canonicalPaths.map((path) => [path, []]));
}

async function findExactBodyMatches(
  request: APIRequestContext,
  baselineIds: Set<string>,
  expectedBodies: Map<string, Buffer>,
): Promise<Map<CanonicalPath, RawCaptureRecord[]>> {
  const matches = emptyMatches();
  const records = await listAllRecords(request);
  for (const record of records) {
    if (baselineIds.has(record.id)) continue;
    const expected = expectedBodies.get(record.path);
    if (!expected || !canonicalPaths.includes(record.path as CanonicalPath)) continue;
    const response = await request.get(`/api/admin/raw-data/records/${record.id}/request?download=1`);
    if (!response.ok()) continue;
    if ((await response.body()).equals(expected)) {
      matches.get(record.path as CanonicalPath)!.push(record);
    }
  }
  return matches;
}

function matchCounts(matches: Map<CanonicalPath, RawCaptureRecord[]>): number[] {
  return canonicalPaths.map((path) => matches.get(path)?.length ?? 0);
}

async function pollForExactRecords(
  request: APIRequestContext,
  baselineIds: Set<string>,
  expectedBodies: Map<string, Buffer>,
): Promise<Map<CanonicalPath, RawCaptureRecord[]>> {
  let matches = emptyMatches();
  await expect.poll(async () => {
    matches = await findExactBodyMatches(request, baselineIds, expectedBodies);
    return matchCounts(matches);
  }, { timeout: 7_500 }).toEqual([1, 1, 1, 1]);
  return matches;
}

test('manual switch controls exact capture across every model entrypoint', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  const startingEnabled = await getCaptureEnabled(request);
  const testMarker = `raw-capture-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  try {
    const fixture = await createGatewayFixture(request);
    await setCaptureEnabled(request, false);
    const baselineIds = new Set((await listAllRecords(request)).map((record) => record.id));
    const disabledBodies = await sendAllFourRawRequests(request, fixture, `${testMarker}:disabled`);
    const disabledMatches = await findExactBodyMatches(request, baselineIds, disabledBodies);
    expect(matchCounts(disabledMatches)).toEqual([0, 0, 0, 0]);

    await setCaptureEnabled(request, true);
    const enabledBodies = await sendAllFourRawRequests(request, fixture, `${testMarker}:enabled`);
    const enabledMatches = await pollForExactRecords(request, baselineIds, enabledBodies);
    for (const path of canonicalPaths) {
      expect(enabledMatches.get(path), `duplicate or missing capture for ${path}`).toHaveLength(1);
    }
  } finally {
    await setCaptureEnabled(request, startingEnabled);
  }
});
