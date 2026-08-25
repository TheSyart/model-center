import { Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { expect, type APIRequestContext, test } from '@playwright/test';
import * as tar from 'tar-stream';

interface GatewayFixture {
  key: string;
  model: string;
}

interface RawCaptureRecord {
  id: string;
  day: string;
  path: string;
  status: number | null;
  stream: boolean;
  location: 'active' | 'archived';
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

const seededRecordId = '22222222-2222-4222-8222-222222222222';
const seededRequest = Buffer.from('e2e-archive-request');
const seededResponse = Buffer.from('e2e-archive-response');

function gatewayHeaders(key: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'user-agent': 'claude-cli/2.1.0',
  };
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

  const headers = gatewayHeaders(fixture.key);
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

async function findRecordsByExactRequest(
  request: APIRequestContext,
  baselineIds: Set<string>,
  path: string,
  expectedBody: Buffer,
): Promise<RawCaptureRecord[]> {
  const matches: RawCaptureRecord[] = [];
  for (const record of await listAllRecords(request)) {
    if (baselineIds.has(record.id) || record.path !== path) continue;
    const response = await request.get(`/api/admin/raw-data/records/${record.id}/request?download=1`);
    if (response.ok() && (await response.body()).equals(expectedBody)) matches.push(record);
  }
  return matches;
}

async function pollForExactRecord(
  request: APIRequestContext,
  baselineIds: Set<string>,
  path: string,
  expectedBody: Buffer,
): Promise<RawCaptureRecord> {
  let matches: RawCaptureRecord[] = [];
  await expect.poll(async () => {
    matches = await findRecordsByExactRequest(request, baselineIds, path, expectedBody);
    return matches.length;
  }, { timeout: 7_500 }).toBe(1);
  return matches[0]!;
}

async function extractTarGzip(bytes: Buffer): Promise<Map<string, Buffer>> {
  const entries = new Map<string, Buffer>();
  const extract = tar.extract();
  extract.on('entry', (header, stream, next) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: unknown) => {
      chunks.push(Buffer.from(chunk as Uint8Array));
    });
    stream.once('end', () => {
      entries.set(header.name, Buffer.concat(chunks));
      next();
    });
  });
  await pipeline(
    Readable.from([bytes]),
    createGunzip(),
    extract as unknown as Writable,
  );
  return entries;
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

test('records streamed SSE and invalid JSON without changing client responses', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  const startingEnabled = await getCaptureEnabled(request);
  const marker = `raw-stream-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

  try {
    const fixture = await createGatewayFixture(request);
    await setCaptureEnabled(request, true);
    const baselineIds = new Set((await listAllRecords(request)).map((record) => record.id));
    const streamedRequest = Buffer.from(JSON.stringify({
      model: fixture.model,
      max_tokens: 64,
      stream: true,
      messages: [{ role: 'user', content: marker }],
    }) + '\n');
    const streamed = await request.fetch('/v1/messages', {
      method: 'POST',
      headers: gatewayHeaders(fixture.key),
      data: streamedRequest.toString(),
    });
    expect(streamed.status()).toBe(200);
    expect(streamed.headers()['content-type']).toContain('text/event-stream');
    const streamedClientBytes = await streamed.body();

    const invalidRequest = Buffer.from(`{ "marker": ${JSON.stringify(marker)}, invalid json`);
    const invalid = await request.fetch('/v1/messages', {
      method: 'POST',
      headers: gatewayHeaders(fixture.key),
      data: invalidRequest,
    });
    expect(invalid.status()).toBe(400);
    const invalidClientBytes = await invalid.body();

    const streamRecord = await pollForExactRecord(
      request,
      baselineIds,
      '/v1/messages',
      streamedRequest,
    );
    expect(streamRecord.status).toBe(200);
    expect(streamRecord.stream).toBe(true);
    const capturedStreamResponse = await request.get(
      `/api/admin/raw-data/records/${streamRecord.id}/response?download=1`,
    );
    expect(capturedStreamResponse.ok(), await capturedStreamResponse.text()).toBeTruthy();
    expect(await capturedStreamResponse.body()).toEqual(streamedClientBytes);

    const invalidRecord = await pollForExactRecord(
      request,
      baselineIds,
      '/v1/messages',
      invalidRequest,
    );
    expect(invalidRecord.status).toBe(400);
    expect(invalidRecord.stream).toBe(false);
    const capturedInvalidResponse = await request.get(
      `/api/admin/raw-data/records/${invalidRecord.id}/response?download=1`,
    );
    expect(capturedInvalidResponse.ok(), await capturedInvalidResponse.text()).toBeTruthy();
    expect(await capturedInvalidResponse.body()).toEqual(invalidClientBytes);
  } finally {
    await setCaptureEnabled(request, startingEnabled);
  }
});

test('raw-data page completes the video-demo workflow on desktop and mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'tablet-768', '视频演示只要求桌面与手机视口');
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await page.goto('/raw-data');
  await expect(page.getByRole('heading', { name: '原始数据' })).toBeVisible();
  await expect(page.getByText(/中转站能够完整留存用户对话/)).toBeVisible();
  await expect(page.getByRole('switch', { name: '记录所有原始对话' })).toBeVisible();
  await expect(page.getByRole('button', { name: /查看记录/ }).first()).toBeVisible();
  await page.getByRole('button', { name: /查看记录/ }).first().click();
  await expect(page.getByRole('dialog', { name: '原始记录详情' })).toBeVisible();
  await expect(page.getByRole('link', { name: '下载完整请求' })).toBeVisible();
  await page.getByRole('tab', { name: 'Response' }).click();
  await expect(page.getByRole('link', { name: '下载完整响应' })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(overflow).toBe(false);
  expect(consoleErrors).toEqual([]);
});

test('archives the deterministic previous-day record and deletes only that day', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  let seededDay: string | null = null;

  try {
    const archiveRun = await request.post('/api/admin/raw-data/archives');
    expect(archiveRun.ok(), await archiveRun.text()).toBeTruthy();

    const recordResponse = await request.get(`/api/admin/raw-data/records/${seededRecordId}`);
    expect(recordResponse.ok(), await recordResponse.text()).toBeTruthy();
    const { record } = await recordResponse.json() as { record: RawCaptureRecord };
    seededDay = record.day;
    expect(record.location).toBe('archived');

    const archivesBefore = await request.get('/api/admin/raw-data/archives');
    expect(archivesBefore.ok(), await archivesBefore.text()).toBeTruthy();
    const beforeDays = ((await archivesBefore.json()) as { archives: Array<{ day: string }> })
      .archives.map((item) => item.day);
    expect(beforeDays).toContain(seededDay);

    const archiveDownload = await request.get(`/api/admin/raw-data/archives/${seededDay}`);
    expect(archiveDownload.ok(), await archiveDownload.text()).toBeTruthy();
    const entries = await extractTarGzip(await archiveDownload.body());
    expect(entries.get(`${seededRecordId}/request.body`)).toEqual(seededRequest);
    expect(entries.get(`${seededRecordId}/response.body`)).toEqual(seededResponse);

    const deleteResponse = await request.delete(`/api/admin/raw-data/archives/${seededDay}`);
    expect(deleteResponse.ok(), await deleteResponse.text()).toBeTruthy();
    const deletedDownload = await request.get(`/api/admin/raw-data/archives/${seededDay}`);
    expect(deletedDownload.status()).toBe(404);

    const archivesAfter = await request.get('/api/admin/raw-data/archives');
    expect(archivesAfter.ok(), await archivesAfter.text()).toBeTruthy();
    const afterDays = ((await archivesAfter.json()) as { archives: Array<{ day: string }> })
      .archives.map((item) => item.day);
    expect(afterDays).toEqual(beforeDays.filter((day) => day !== seededDay));
  } finally {
    if (seededDay) {
      const existing = await request.get(`/api/admin/raw-data/archives/${seededDay}`);
      if (existing.ok()) await request.delete(`/api/admin/raw-data/archives/${seededDay}`);
    }
  }
});
