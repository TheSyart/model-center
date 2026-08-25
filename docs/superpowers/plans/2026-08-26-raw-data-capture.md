# Model Center Raw Data Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Add a manually armed local recorder for every Model Center model-request entrypoint, preserve request and final client-response body bytes, expose them in a responsive admin module, and archive each completed local day into one tar.gz.

**Architecture:** A route-handler wrapper captures application-layer request bytes before existing validation and wraps the final Response body without entering provider routing or protocol adapters. Active records live as files under MODEL_CENTER_DB_DIR while better-sqlite3 stores metadata indexes; a lazy archive service atomically converts closed days into tar.gz files. Admin APIs and the /raw-data page consume only the index and local files.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Web ReadableStream, Node fs/streams/zlib, tar-stream, better-sqlite3, Radix/shadcn, Sonner, Node test runner, Vitest/Testing Library, Playwright.

**Spec:** docs/superpowers/specs/2026-08-26-raw-data-capture-design.md

## Global Constraints

- Work directly on main, preserving unrelated user changes.
- Capture POST /v1/messages, /v1/chat/completions, /v1/responses, and /security-lab/v1/messages exactly once each.
- The switch defaults off; the disabled path must not clone bodies, create files, or wrap responses.
- Store NextRequest/Response application-layer body bytes unchanged; never format, redact, summarize, classify, or search body content.
- Never persist Authorization, x-api-key, Cookie, provider credentials, or arbitrary request headers.
- Store only under MODEL_CENTER_DB_DIR/raw-captures, or data/raw-captures when the environment variable is absent.
- Capture and archive failures must never change the model response received by the client.
- Produce at most one archives/YYYY-MM-DD.tar.gz per completed local natural day; never pre-archive the current day.
- Do not add external upload, cron, Shell execution, public APIs, or SQLite BLOB body storage.
- Do not modify generated provider catalogs, pricing files, CC Switch outputs, or public/logos/*.
- Introduce every production behavior through a failing focused test and commit each task separately.

## File Map

**Core**

- Create lib/raw-capture/types.ts: shared config, record, archive, pagination, and session types.
- Create lib/raw-capture/paths.ts: validated root/day/UUID paths and local-day calculation.
- Create lib/raw-capture/config.ts: raw_capture_enabled persistence and default wrappers.
- Create lib/raw-capture/store.ts: private SQLite index tables plus active-file record lifecycle.
- Create lib/raw-capture/response-observer.ts: bounded ordered response-byte recorder.
- Create lib/raw-capture/capture.ts: route-handler wrapper and default runtime composition.
- Create lib/raw-capture/archive.ts: lazy tar.gz creation, verification, recovery, download lookup, and deletion.
- Create lib/raw-capture/admin.ts: query parsing and admin response assembly.

**Gateway integration**

- Modify app/api/v1/messages/route.ts.
- Modify app/api/v1/chat/completions/route.ts.
- Modify app/api/v1/responses/route.ts.
- Modify app/(admin)/security-lab/v1/messages/route.ts.

**Admin API**

- Create app/api/admin/raw-data/config/route.ts.
- Create app/api/admin/raw-data/records/route.ts.
- Create app/api/admin/raw-data/records/[id]/route.ts.
- Create app/api/admin/raw-data/records/[id]/[part]/route.ts.
- Create app/api/admin/raw-data/archives/route.ts.
- Create app/api/admin/raw-data/archives/[day]/route.ts.

**UI**

- Create app/(admin)/raw-data/page.tsx.
- Create app/(admin)/raw-data/raw-data-client.tsx.
- Create app/(admin)/raw-data/capture-control.tsx.
- Create app/(admin)/raw-data/raw-record-list.tsx.
- Create app/(admin)/raw-data/raw-record-detail.tsx.
- Create app/(admin)/raw-data/archive-list.tsx.
- Modify components/nav.tsx.

**Tests and dependencies**

- Create tests/raw-capture-store.test.ts.
- Create tests/raw-capture-response-observer.test.ts.
- Create tests/raw-capture-wrapper.test.ts.
- Create tests/raw-capture-archive.test.ts.
- Create tests/raw-capture-admin.test.ts.
- Create tests/ui/raw-data.test.tsx.
- Create tests/e2e/raw-data.spec.ts.
- Create tests/raw-capture-e2e-seed.ts.
- Modify tests/ui/admin-shell.test.tsx.
- Modify tests/e2e/admin-responsive.spec.ts.
- Modify playwright.config.ts for the deterministic previous-day archive fixture.
- Modify package.json and package-lock.json for tar-stream and @types/tar-stream.

---

### Task 1: Raw-Capture Types, Paths, Configuration, and Active Store

**Files:**
- Create: lib/raw-capture/types.ts
- Create: lib/raw-capture/paths.ts
- Create: lib/raw-capture/config.ts
- Create: lib/raw-capture/store.ts
- Test: tests/raw-capture-store.test.ts

**Interfaces:**
- Produces: RawCaptureEntry, RawCaptureRecord, RawCaptureArchive, RawCapturePage, RawCaptureStatus, RawCaptureSession.
- Produces: createRawCaptureConfigStore(sqlite), getRawCaptureEnabled(), setRawCaptureEnabled(enabled).
- Produces: createRawCaptureStore(sqlite, options), beginRecord(input), listRecords(input), getRecord(id), getStatus().
- RawCaptureSession exposes appendResponse(chunk), finish(result), and fail(message).

- [ ] **Step 1: Write failing path, configuration, and byte-preservation tests**

~~~ts
test('defaults capture to disabled and persists only 0 or 1', () => {
  const sqlite = new Database(':memory:');
  const config = createRawCaptureConfigStore(sqlite);
  assert.equal(config.getEnabled(), false);
  config.setEnabled(true);
  assert.equal(config.getEnabled(), true);
});

test('writes request bytes without parsing or re-encoding', async () => {
  const request = new TextEncoder().encode('{  "model":"演示", "messages":[] }\n');
  const store = createRawCaptureStore(sqlite, {
    rootDir,
    now: () => new Date('2026-08-26T03:04:05+08:00').getTime(),
    id: () => '11111111-1111-4111-8111-111111111111',
  });
  const session = await store.beginRecord({
    entryProtocol: 'anthropic',
    path: '/v1/messages',
    requestBody: request,
  });
  assert.deepEqual(
    readFileSync(join(rootDir, 'active/2026-08-26/11111111-1111-4111-8111-111111111111/request.body')),
    Buffer.from(request),
  );
  await session.finish({ status: 200, stream: false, contentType: 'application/json', complete: true });
});

test('rejects traversal-shaped IDs and dates', () => {
  assert.throws(() => assertRecordId('../secret'), /记录 ID/);
  assert.throws(() => assertArchiveDay('2026-08-26/../x'), /日期/);
});

test('keeps crash-leftover files and exposes the record as incomplete', async () => {
  await createUnfinishedFixture(rootDir, sqlite);
  const recovered = createRawCaptureStore(sqlite, { rootDir }).getRecord(
    '11111111-1111-4111-8111-111111111111',
  );
  assert.equal(recovered?.complete, false);
  assert.equal(existsSync(join(recordDir, 'request.body')), true);
});
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run: node --experimental-strip-types --test tests/raw-capture-store.test.ts

Expected: FAIL because lib/raw-capture modules do not exist.

- [ ] **Step 3: Implement exact shared types and validators**

~~~ts
export type RawCaptureEntry = 'openai' | 'anthropic' | 'responses' | 'security-lab-anthropic';
export type RawCaptureLocation = 'active' | 'archived';

export interface RawCaptureConfig {
  enabled: boolean;
}

export interface RawCaptureRecord {
  id: string;
  day: string;
  startedAt: number;
  completedAt: number | null;
  path: string;
  entryProtocol: RawCaptureEntry;
  status: number | null;
  stream: boolean;
  contentType: string | null;
  requestBytes: number;
  responseBytes: number;
  complete: boolean;
  captureError: string | null;
  location: RawCaptureLocation;
}

export interface RawCaptureSession {
  record: RawCaptureRecord;
  appendResponse(chunk: Uint8Array): Promise<void>;
  finish(input: {
    status: number;
    stream: boolean;
    contentType: string | null;
    complete: boolean;
    captureError?: string | null;
  }): Promise<RawCaptureRecord>;
  fail(message: string): Promise<RawCaptureRecord>;
}

export interface RawCaptureArchive {
  day: string;
  recordCount: number;
  rawBytes: number;
  archiveBytes: number;
  createdAt: number;
  status: 'ready' | 'error';
  error: string | null;
}

export interface RawCapturePage {
  items: RawCaptureRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface RawCaptureStatus {
  enabled: boolean;
  rootDir: string;
  today: string;
  todayRecords: number;
  todayBytes: number;
  totalRecords: number;
  totalBytes: number;
  archiveCount: number;
  coverageStart: number | null;
  coverageEnd: number | null;
  lastArchive: RawCaptureArchive | null;
  lastCaptureError: string | null;
}
~~~

paths.ts must export rawCaptureRoot(), localDay(timestamp), assertRecordId(id), assertArchiveDay(day), activeRecordDir(root, day, id), and archivePath(root, day). Resolve and verify every result remains under the raw-captures root.

- [ ] **Step 4: Implement private tables and active-file lifecycle**

store.ts must create these tables idempotently:

~~~sql
CREATE TABLE IF NOT EXISTS raw_capture_records (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  path TEXT NOT NULL,
  entry_protocol TEXT NOT NULL,
  status INTEGER,
  stream INTEGER NOT NULL DEFAULT 0,
  content_type TEXT,
  request_bytes INTEGER NOT NULL DEFAULT 0,
  response_bytes INTEGER NOT NULL DEFAULT 0,
  complete INTEGER NOT NULL DEFAULT 0,
  capture_error TEXT,
  location TEXT NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_raw_capture_records_day_started
ON raw_capture_records(day DESC, started_at DESC);
CREATE TABLE IF NOT EXISTS raw_capture_archives (
  day TEXT PRIMARY KEY,
  record_count INTEGER NOT NULL,
  raw_bytes INTEGER NOT NULL,
  archive_bytes INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL,
  error TEXT
);
~~~

beginRecord must create the record directory, atomically write request.body and initial metadata.json, insert the index row, and open response.body with exclusive creation. finish must sync and close the response file before atomically replacing metadata.json and updating SQLite. Store initialization must preserve crash-leftover files, reconcile missing index rows from metadata.json, and leave unfinished records visible with complete=false. The metadata JSON keys must match RawCaptureRecord and contain no headers.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: node --experimental-strip-types --test tests/raw-capture-store.test.ts

Expected: PASS; temporary directories are removed in test cleanup.

- [ ] **Step 6: Commit Task 1**

~~~bash
git add lib/raw-capture/types.ts lib/raw-capture/paths.ts lib/raw-capture/config.ts lib/raw-capture/store.ts tests/raw-capture-store.test.ts
git commit -m "feat: add raw capture storage foundation"
~~~

---

### Task 2: Ordered Bounded Response Observer

**Files:**
- Create: lib/raw-capture/response-observer.ts
- Test: tests/raw-capture-response-observer.test.ts

**Interfaces:**
- Consumes: RawCaptureSession.appendResponse(), finish(), and fail() from Task 1.
- Produces: observeResponseBody(input, sink, options): { stream, done }.
- The sink contract is write(chunk), close(result), and fail(error).

- [ ] **Step 1: Write failing byte, backpressure, cancellation, overflow, and disk-error tests**

~~~ts
test('returns exactly the input bytes and records them in order', async () => {
  const input = streamOf([bytes('event: a\n\n'), bytes('data: 世界\n\n')]);
  const recorded: Uint8Array[] = [];
  const observed = observeResponseBody(input, {
    write: async (chunk) => { recorded.push(chunk.slice()); },
    close: async () => {},
    fail: async () => {},
  });
  assert.deepEqual(await readAll(observed.stream), concat(recorded));
  await observed.done;
});

test('client cancellation cancels upstream and finalizes as incomplete', async () => {
  let cancelled = false;
  const input = new ReadableStream({
    pull(controller) { controller.enqueue(bytes('first')); },
    cancel() { cancelled = true; },
  });
  const result = observeResponseBody(input, sink);
  await result.stream.cancel('stop');
  assert.equal(cancelled, true);
  assert.equal((await result.done).complete, false);
});

test('bounded queue abandons capture but keeps client bytes flowing', async () => {
  const gate = deferred<void>();
  const result = observeResponseBody(streamOf([bytes('1234'), bytes('5678')]), slowSink(gate), {
    maxBufferedBytes: 4,
  });
  assert.equal(new TextDecoder().decode(await readAll(result.stream)), '12345678');
  gate.resolve();
  assert.match((await result.done).captureError ?? '', /缓冲上限/);
});
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run: node --experimental-strip-types --test tests/raw-capture-response-observer.test.ts

Expected: FAIL because observeResponseBody is missing.

- [ ] **Step 3: Implement a single-reader observer with an ordered finite queue**

~~~ts
export interface ResponseCaptureSink {
  write(chunk: Uint8Array): Promise<void>;
  close(result: { complete: boolean; responseBytes: number; captureError: string | null }): Promise<void>;
  fail(error: unknown): Promise<void>;
}

export function observeResponseBody(
  input: ReadableStream<Uint8Array>,
  sink: ResponseCaptureSink,
  options: { maxBufferedBytes?: number } = {},
): {
  stream: ReadableStream<Uint8Array>;
  done: Promise<{ complete: boolean; responseBytes: number; captureError: string | null }>;
}
~~~

Use one input reader. Enqueue a copied chunk to the client immediately, serialize file writes through one promise chain, and track queued bytes. At maxBufferedBytes, stop scheduling writes and set one stable capture error while continuing client delivery. On cancel, cancel upstream first and then settle queued writes. Catch sink errors internally so no rejection escapes into the client stream.

- [ ] **Step 4: Run observer and existing stream regression tests**

Run: node --experimental-strip-types --test tests/raw-capture-response-observer.test.ts tests/stream-observer.test.ts tests/stream-setup.test.ts

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

~~~bash
git add lib/raw-capture/response-observer.ts tests/raw-capture-response-observer.test.ts
git commit -m "feat: observe response bytes for raw capture"
~~~

---

### Task 3: Route-Handler Capture Wrapper

**Files:**
- Create: lib/raw-capture/capture.ts
- Test: tests/raw-capture-wrapper.test.ts

**Interfaces:**
- Consumes: getRawCaptureEnabled(), createRawCaptureStore(), and observeResponseBody().
- Produces: withRawCapture(options, handler, dependencies?): route handler with the same NextRequest-to-Response contract.
- Produces: triggerArchiveCheck() callback hook; Task 4 supplies the default implementation.

- [ ] **Step 1: Write failing disabled, exact-body, error-response, and thrown-handler tests**

~~~ts
test('disabled wrapper passes the original request and response through without cloning', async () => {
  const request = nextRequest('/v1/messages', rawJson);
  const handler = async (seen: NextRequest) => {
    assert.equal(seen, request);
    return new Response('ok', { status: 201 });
  };
  const response = await withRawCapture(
    { entry: 'anthropic', path: '/v1/messages' },
    handler,
    deps({ enabled: false }),
  )(request);
  assert.equal(await response.text(), 'ok');
  assert.equal(store.beginCalls, 0);
});

test('enabled wrapper stores exact request and final response bytes', async () => {
  const raw = '{  "model":"x", "messages":[{"role":"user","content":"你好"}] }\n';
  const response = await withRawCapture({ entry: 'anthropic', path: '/v1/messages' }, async () =>
    new Response(bytes('data: 原样\n\n'), {
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
    }), deps({ enabled: true }))(nextRequest('/v1/messages', raw));
  assert.equal(new TextDecoder().decode(await readAll(response.body!)), 'data: 原样\n\n');
  assert.deepEqual(store.requestBody, bytes(raw));
  assert.deepEqual(store.responseBody, bytes('data: 原样\n\n'));
});

test('captures a 401 response without reading or persisting request headers', async () => {
  const response = await wrapped(requestWithAuthorization);
  assert.equal(response.status, 401);
  assert.equal(JSON.stringify(store.metadata).includes('secret-key'), false);
});
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run: node --experimental-strip-types --test tests/raw-capture-wrapper.test.ts

Expected: FAIL because withRawCapture is missing.

- [ ] **Step 3: Implement the wrapper and preserve Response semantics**

~~~ts
export type RawCaptureRouteHandler = (request: NextRequest) => Response | Promise<Response>;

export function withRawCapture(
  options: { entry: RawCaptureEntry; path: string },
  handler: RawCaptureRouteHandler,
  dependencies: RawCaptureDependencies = defaultRawCaptureDependencies,
): RawCaptureRouteHandler;
~~~

When disabled, call handler(request) immediately. When enabled, read request.clone().arrayBuffer() for capture while passing the untouched original request to handler. Create a replacement Response only when response.body exists; preserve status, statusText, and all response headers. An empty response creates an empty response.body file and completes immediately. Handler throws must mark the record failed and rethrow. Archive checking is fire-and-forget with rejection consumed and recorded.

- [ ] **Step 4: Run focused tests and TypeScript**

Run: node --experimental-strip-types --test tests/raw-capture-wrapper.test.ts

Run: npm run typecheck

Expected: both PASS.

- [ ] **Step 5: Commit Task 3**

~~~bash
git add lib/raw-capture/capture.ts tests/raw-capture-wrapper.test.ts
git commit -m "feat: wrap model handlers with raw capture"
~~~

---

### Task 4: Daily tar.gz Archive Service and Recovery

**Files:**
- Modify: package.json
- Modify: package-lock.json
- Create: lib/raw-capture/archive.ts
- Test: tests/raw-capture-archive.test.ts

**Interfaces:**
- Consumes: validated paths and RawCaptureStore from Task 1.
- Produces: createRawCaptureArchiveService(store, options).
- Produces: archiveClosedDays(), listArchives(), openArchive(day), deleteArchive(day), openArchivedPart(record, part).

- [ ] **Step 1: Install tar-stream and its TypeScript declarations**

Run: npm install tar-stream

Run: npm install -D @types/tar-stream

Expected: package.json and package-lock.json contain tar-stream and @types/tar-stream; npm install exits 0.

- [ ] **Step 2: Write failing archive, pending-record, atomic-failure, and recovery tests**

~~~ts
test('creates one verified tar.gz for a closed local day', async () => {
  await fixture.complete('2026-08-25', 'record-a', requestBytes, responseBytes);
  const result = await archive.archiveClosedDays(new Date('2026-08-26T08:00:00+08:00').getTime());
  assert.deepEqual(result.archived, ['2026-08-25']);
  assert.equal(existsSync(join(rootDir, 'archives/2026-08-25.tar.gz')), true);
  assert.deepEqual(await archive.openArchivedPart('record-a', 'request'), requestBytes);
});

test('skips a day with an unfinished record', async () => {
  await fixture.beginOnly('2026-08-25', 'record-open');
  const result = await archive.archiveClosedDays(now26);
  assert.deepEqual(result.skipped, [{ day: '2026-08-25', reason: 'unfinished_records' }]);
});

test('never archives the current local day', async () => {
  await fixture.complete('2026-08-26', 'record-current', requestBytes, responseBytes);
  const result = await archive.archiveClosedDays(now26);
  assert.equal(result.archived.includes('2026-08-26'), false);
  assert.equal(existsSync(join(rootDir, 'active/2026-08-26')), true);
});

test('compression failure keeps the source directory and never publishes final archive', async () => {
  const service = createRawCaptureArchiveService(store, { rootDir, createArchive: failingWriter });
  await service.archiveClosedDays(now26);
  assert.equal(existsSync(activeDayPath), true);
  assert.equal(existsSync(finalArchivePath), false);
});
~~~

- [ ] **Step 3: Implement streamed tar.gz creation and verification**

Use tar-stream pack/extract and node:zlib createGzip/createGunzip. Add files in deterministic record-id and filename order. Pipe to a UUID temp file opened with exclusive creation. Verification must stream through the finished gzip, count request.body, response.body, and metadata.json entries, and compare against the day index before rename.

~~~ts
export interface ArchiveRunResult {
  archived: string[];
  skipped: Array<{ day: string; reason: 'unfinished_records' | 'already_archived' }>;
  errors: Array<{ day: string; message: string }>;
}
~~~

After verified rename, update archive index and record locations in one SQLite transaction, then remove the source day directory. Recovery must reconcile a final archive with active index rows, ignore current-day directories, and remove only invalid UUID-named temp files older than 24 hours. deleteArchive(day) must delete only the validated archive file, its raw_capture_archives row, and raw_capture_records rows for that archived day; it must not touch active or other-day records.

- [ ] **Step 4: Run archive and store tests**

Run: node --experimental-strip-types --test tests/raw-capture-archive.test.ts tests/raw-capture-store.test.ts

Expected: PASS, including byte-for-byte extraction assertions.

- [ ] **Step 5: Commit Task 4**

~~~bash
git add package.json package-lock.json lib/raw-capture/archive.ts tests/raw-capture-archive.test.ts
git commit -m "feat: archive raw captures by local day"
~~~

---

### Task 5: Raw-Data Admin Service and API Routes

**Files:**
- Create: lib/raw-capture/admin.ts
- Create: app/api/admin/raw-data/config/route.ts
- Create: app/api/admin/raw-data/records/route.ts
- Create: app/api/admin/raw-data/records/[id]/route.ts
- Create: app/api/admin/raw-data/records/[id]/[part]/route.ts
- Create: app/api/admin/raw-data/archives/route.ts
- Create: app/api/admin/raw-data/archives/[day]/route.ts
- Test: tests/raw-capture-admin.test.ts

**Interfaces:**
- Consumes: config/store/archive services from Tasks 1 and 4.
- Produces: parseRawRecordPagination(), getRawDataDashboard(), openRecordPart().
- API responses match RawCaptureStatus, RawCapturePage, RawCaptureRecord, and RawCaptureArchive.

- [ ] **Step 1: Write failing validation and admin-service tests**

~~~ts
test('clamps record pagination to page 1 and page size 100', () => {
  assert.deepEqual(parseRawRecordPagination(new URLSearchParams('page=-2&page_size=500')), {
    page: 1,
    pageSize: 100,
  });
});

test('allows only request or response record parts', () => {
  assert.equal(assertRecordPart('request'), 'request');
  assert.throws(() => assertRecordPart('../../metadata'), /正文类型/);
});

test('dashboard statistics use metadata only', async () => {
  const dashboard = await getRawDataDashboard(services);
  assert.deepEqual(dashboard.status, {
    enabled: false,
    rootDir,
    today: '2026-08-26',
    todayRecords: 2,
    todayBytes: 120,
    totalRecords: 5,
    totalBytes: 900,
    archiveCount: 1,
    coverageStart: 100,
    coverageEnd: 500,
    lastArchive: archiveRow,
    lastCaptureError: null,
  });
});
~~~

- [ ] **Step 2: Run the focused test and verify RED**

Run: node --experimental-strip-types --test tests/raw-capture-admin.test.ts

Expected: FAIL because admin.ts is missing.

- [ ] **Step 3: Implement the admin service and exact API contracts**

GET /api/admin/raw-data/config returns:

~~~json
{ "config": { "enabled": false }, "status": { "todayRecords": 0, "todayBytes": 0 } }
~~~

PUT accepts only an object with boolean enabled and returns the saved config/status. GET records returns { items, total, page, pageSize }. GET record returns { record }. GET record part defaults to a 262144-byte preview and sets X-Raw-Total-Bytes and X-Raw-Truncated; download=1 streams the complete bytes with Content-Disposition attachment. GET archive by day streams the complete tar.gz. POST archives runs archiveClosedDays and returns ArchiveRunResult. DELETE archive removes exactly one validated day and returns { deleted: true, day }.

All body and archive responses set Cache-Control: no-store. Missing records return 404, invalid IDs/dates/parts return 400, missing files return 410, and internal failures return a stable { error } JSON response.

- [ ] **Step 4: Run admin tests and TypeScript**

Run: node --experimental-strip-types --test tests/raw-capture-admin.test.ts tests/raw-capture-archive.test.ts

Run: npm run typecheck

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

~~~bash
git add lib/raw-capture/admin.ts app/api/admin/raw-data tests/raw-capture-admin.test.ts
git commit -m "feat: expose raw capture admin APIs"
~~~

---

### Task 6: Integrate All Four Model Request Entrypoints

**Files:**
- Modify: app/api/v1/messages/route.ts
- Modify: app/api/v1/chat/completions/route.ts
- Modify: app/api/v1/responses/route.ts
- Modify: app/(admin)/security-lab/v1/messages/route.ts
- Create: tests/e2e/raw-data.spec.ts

**Interfaces:**
- Consumes: withRawCapture() from Task 3 and config API from Task 5.
- Produces: one capture per public request with no gateway protocol changes.

- [ ] **Step 1: Add a failing desktop Playwright test for disabled and enabled capture**

~~~ts
test('manual switch controls exact capture across every model entrypoint', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  const fixture = await createGatewayFixture(request);
  await request.put('/api/admin/raw-data/config', { data: { enabled: false } });
  const baseline = await listRecords(request);
  await sendAllFourRequests(request, fixture, 'disabled-marker');
  expect((await listRecords(request)).total).toBe(baseline.total);

  await request.put('/api/admin/raw-data/config', { data: { enabled: true } });
  const bodies = await sendAllFourRawRequests(request, fixture, 'raw-marker');
  const records = await pollForNewRecords(request, baseline.total, 4);
  expect(new Set(records.items.map((item) => item.path))).toEqual(new Set([
    '/v1/messages',
    '/v1/chat/completions',
    '/v1/responses',
    '/security-lab/v1/messages',
  ]));
  await expectDownloadedBodiesToEqual(request, records.items, bodies);
});
~~~

Implement sendAllFourRawRequests as a helper that calls APIRequestContext.fetch with method POST, content-type application/json, the gateway key, and a raw string in data for each path. Use these four exact body shapes and include a unique marker in each user/input string:

~~~ts
const rawBodies = new Map([
  ['/v1/messages', JSON.stringify({ model, max_tokens: 64, messages: [{ role: 'user', content: marker }] }) + '\n'],
  ['/v1/chat/completions', '{  "model":' + JSON.stringify(model) + ', "messages":[{"role":"user","content":' + JSON.stringify(marker) + '}] }\n'],
  ['/v1/responses', JSON.stringify({ model, input: marker }) + '\n'],
  ['/security-lab/v1/messages', JSON.stringify({ model, max_tokens: 64, messages: [{ role: 'user', content: marker }] }) + '\n'],
]);
~~~

sendAllFourRequests calls the same helper and discards its returned map. pollForNewRecords repeatedly calls GET /api/admin/raw-data/records?page=1&page_size=100 until total is baselineTotal + expectedCount or 7500 ms elapses. expectDownloadedBodiesToEqual matches each new record by record.path, downloads /api/admin/raw-data/records/{id}/request?download=1, and compares response.body() to the corresponding Buffer from rawBodies.

- [ ] **Step 2: Run the focused E2E test and verify RED**

Run: npx playwright test tests/e2e/raw-data.spec.ts --project=desktop-1440

Expected: FAIL because the four handlers are not wrapped.

- [ ] **Step 3: Refactor each POST into an inner handler and export the wrapped handler**

Use this exact pattern in each route, preserving its existing body:

~~~ts
async function handlePost(req: NextRequest): Promise<Response> {
  // Existing POST implementation unchanged.
}

export const POST = withRawCapture(
  { entry: 'anthropic', path: '/v1/messages' },
  handlePost,
);
~~~

Use exact option pairs { openai, /v1/chat/completions }, { anthropic, /v1/messages }, { responses, /v1/responses }, and { security-lab-anthropic, /security-lab/v1/messages }. Do not call withRawCapture inside runGatewayPipeline or runSecurityLabRewrite. Preserve every existing GET export.

- [ ] **Step 4: Run focused E2E, core gateway regressions, and typecheck**

Run: npx playwright test tests/e2e/raw-data.spec.ts --project=desktop-1440

Run: npm run test:core

Run: npm run typecheck

Expected: all PASS; records total increases by exactly four.

- [ ] **Step 5: Commit Task 6**

~~~bash
git add app/api/v1/messages/route.ts app/api/v1/chat/completions/route.ts app/api/v1/responses/route.ts 'app/(admin)/security-lab/v1/messages/route.ts' tests/e2e/raw-data.spec.ts
git commit -m "feat: capture every model request entrypoint"
~~~

---

### Task 7: Responsive Raw-Data Admin Module

**Files:**
- Create: app/(admin)/raw-data/page.tsx
- Create: app/(admin)/raw-data/raw-data-client.tsx
- Create: app/(admin)/raw-data/capture-control.tsx
- Create: app/(admin)/raw-data/raw-record-list.tsx
- Create: app/(admin)/raw-data/raw-record-detail.tsx
- Create: app/(admin)/raw-data/archive-list.tsx
- Modify: components/nav.tsx
- Create: tests/ui/raw-data.test.tsx
- Modify: tests/ui/admin-shell.test.tsx
- Modify: tests/e2e/admin-responsive.spec.ts

**Interfaces:**
- Consumes: all Task 5 admin API response shapes.
- Produces: /raw-data and the Security navigation item named 原始数据.
- RawDataClient owns loading, pagination, selected record, config mutation, archive run, download links, and notices.

- [ ] **Step 1: Write failing UI tests for navigation, arming, records, details, archives, and axe**

~~~tsx
it('requires confirmation before enabling full raw capture', async () => {
  installRawDataApi();
  render(<RawDataClient />);
  await user.click(await screen.findByRole('switch', { name: '记录所有原始对话' }));
  expect(screen.getByRole('alertdialog', { name: '开启原始数据采集？' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: '确认开启' }));
  expect(lastPutBody()).toEqual({ enabled: true });
});

it('shows unformatted request and response previews in a focus-managed sheet', async () => {
  installRawDataApi({ requestPreview: '{  "model":"x" }', responsePreview: 'data: {"x":1}\n\n' });
  render(<RawDataClient />);
  await user.click(await screen.findByRole('button', { name: /查看记录/ }));
  const dialog = screen.getByRole('dialog', { name: '原始记录详情' });
  expect(within(dialog).getByText('{  "model":"x" }', { exact: true })).toBeVisible();
  expect(within(dialog).getByText(/仅预览前/)).toBeVisible();
});

it('has no serious accessibility violations', async () => {
  installRawDataApi();
  const { container } = render(<RawDataClient />);
  await screen.findByText('今日原始数据');
  const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
  expect(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});
~~~

Update admin-shell.test.tsx to assert a link named 原始数据 with href /raw-data.

- [ ] **Step 2: Run UI tests and verify RED**

Run: npm run test:ui -- tests/ui/raw-data.test.tsx tests/ui/admin-shell.test.tsx

Expected: FAIL because RawDataClient and navigation do not exist.

- [ ] **Step 3: Implement page composition and state container**

page.tsx uses PageHeader:

~~~tsx
<PageHeader
  heading="原始数据"
  description="展示中转站能够完整留存用户对话并按日打包的风险；所有数据只保存在本机。"
/>
<RawDataClient />
~~~

RawDataClient loads config/status, page-1 records, and archives in parallel. Poll every 2000 ms only while capture is enabled. Use requestJson for JSON endpoints, use direct anchor hrefs for binary downloads, preserve the selected record during refresh, and send all success/error feedback through visible role=status/role=alert regions plus Sonner where already used by the app.

- [ ] **Step 4: Implement focused presentational components**

capture-control.tsx renders the Switch, status badge, storage path, today counts, total counts, archive count, coverage time, and last error. Use useConfirm with title 开启原始数据采集？ and confirm text 确认开启.

raw-record-list.tsx renders desktop semantic table and md:hidden cards. Each row button has accessible name 查看记录 {id}. Show protocol, path, status, stream, byte sizes, and 完整/不完整 badges.

raw-record-detail.tsx renders a wide Sheet with Request/Response Tabs, whitespace-pre-wrap font-mono preview, truncation notice, and full-download buttons. Do not JSON.parse or JSON.stringify preview text.

archive-list.tsx renders date, counts, raw/compressed sizes, state, archive-check action, download, and per-day deletion behind useConfirm. Do not render a clear-all action.

- [ ] **Step 5: Add navigation and responsive coverage**

Add DatabaseBackup to the existing 安全 group after 中转风险. Add /raw-data to tests/e2e/admin-responsive.spec.ts pages and wait for initial load before checking document overflow.

- [ ] **Step 6: Run UI and responsive E2E tests**

Run: npm run test:ui -- tests/ui/raw-data.test.tsx tests/ui/admin-shell.test.tsx

Run: npx playwright test tests/e2e/admin-responsive.spec.ts

Expected: PASS in mobile-375, tablet-768, and desktop-1440 with no console errors or page-level horizontal overflow.

- [ ] **Step 7: Commit Task 7**

~~~bash
git add 'app/(admin)/raw-data' components/nav.tsx tests/ui/raw-data.test.tsx tests/ui/admin-shell.test.tsx tests/e2e/admin-responsive.spec.ts
git commit -m "feat: add raw data security dashboard"
~~~

---

### Task 8: Archive Workflow E2E and Full Delivery Verification

**Files:**
- Modify: tests/e2e/raw-data.spec.ts
- Create: tests/raw-capture-e2e-seed.ts
- Modify: playwright.config.ts
- Modify only if verification exposes a scoped defect: files introduced in Tasks 1-7.

**Interfaces:**
- Consumes: completed raw-capture feature.
- Produces: delivery evidence for exact bytes, manual control, daily archive APIs, mobile UI, and zero regressions.

- [ ] **Step 1: Extend E2E with streaming, invalid JSON, UI, download, and archive checks**

~~~ts
test('records SSE and invalid JSON without changing client responses', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-1440');
  await enableCapture(request);
  const before = await listRecords(request);
  const streamed = await sendAnthropicStream(request, fixture, rawStreamBody);
  const invalid = await request.post('/v1/messages', {
    headers: gatewayHeaders(fixture.key),
    data: '{ invalid json',
  });
  expect(invalid.status()).toBe(400);
  const newRecords = await pollForNewRecords(request, before.total, 2);
  const streamRecord = newRecords.items.find((item) => item.stream);
  const invalidRecord = newRecords.items.find((item) => item.status === 400);
  expect(streamRecord).toBeTruthy();
  expect(invalidRecord).toBeTruthy();
  await expectCapturedResponseToEqual(request, streamRecord!.id, await streamed.response.body());
  await expectCapturedRequestToEqual(request, invalidRecord!.id, Buffer.from('{ invalid json'));
});

test('raw-data page completes the video-demo workflow on desktop and mobile', async ({ page }, testInfo) => {
  await page.goto('/raw-data');
  await expect(page.getByRole('heading', { name: '原始数据' })).toBeVisible();
  await expect(page.getByText('中转站能够完整留存')).toBeVisible();
  await page.getByRole('button', { name: /查看记录/ }).first().click();
  await expect(page.getByRole('dialog', { name: '原始记录详情' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
~~~

- [ ] **Step 2: Add a deterministic previous-day seed before the Playwright server starts**

tests/raw-capture-e2e-seed.ts must open MODEL_CENTER_DB_DIR/model-center.db with better-sqlite3, create a RawCaptureStore rooted at MODEL_CENTER_DB_DIR/raw-captures, and insert one completed record using a timestamp exactly 86400000 ms before startup. Use UUID 22222222-2222-4222-8222-222222222222, request bytes e2e-archive-request, and response bytes e2e-archive-response. If that ID already exists, exit successfully without changing it.

Update the Next.js webServer command in playwright.config.ts to run the seed with the same MODEL_CENTER_DB_DIR before npm run dev:

~~~ts
command: 'MODEL_CENTER_DB_DIR=.playwright-data node --experimental-strip-types tests/raw-capture-e2e-seed.ts && MODEL_CENTER_DB_DIR=.playwright-data npm run dev -- --hostname 127.0.0.1 --port 3100',
~~~

Extend raw-data.spec.ts with one desktop test that calls POST /api/admin/raw-data/archives, downloads the seeded day from GET /api/admin/raw-data/archives/{day}, inspects it with tar-stream, and asserts the two seeded byte strings. DELETE the seeded day and assert a second GET returns 404. Do not delete any other day.

- [ ] **Step 3: Run raw-data E2E in all viewports**

Run: npx playwright test tests/e2e/raw-data.spec.ts

Expected: PASS; desktop-only protocol tests are skipped on mobile/tablet and the UI workflow passes where selected.

- [ ] **Step 4: Run all core and UI tests**

Run: npm test

Expected: every existing and new Node/Vitest test passes.

- [ ] **Step 5: Run all Playwright tests**

Run: npm run test:e2e

Expected: every applicable test passes across 375x812, 768x1024, and 1440x900; viewport-specific skips are expected.

- [ ] **Step 6: Run static and production checks**

Run: npm run typecheck

Run: npm run build

Expected: both exit 0; build lists /raw-data and all raw-data admin routes.

- [ ] **Step 7: Inspect final changes and verify generated paths are untouched**

Run: git status --short

Run: git diff --check

Run: git diff --name-only 73f4525..HEAD

Expected: no generated lib/presets files, lib/pricing files, or public/logos files appear. Only scoped raw-capture, route-wrapper, UI, test, dependency, spec, and plan files are present.

- [ ] **Step 8: Commit final E2E hardening**

~~~bash
git add tests/e2e/raw-data.spec.ts tests/raw-capture-e2e-seed.ts playwright.config.ts
git commit -m "test: verify raw data capture workflows"
~~~
