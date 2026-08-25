import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import test from 'node:test';
import { createGzip } from 'node:zlib';
import * as tar from 'tar-stream';

import { extractSeededRawCaptureTarGzip } from './raw-capture-e2e-tar.ts';

const recordId = '22222222-2222-4222-8222-222222222222';
const canonicalEntries = [
  { name: `${recordId}/metadata.json`, body: Buffer.from('{"id":"seed"}') },
  { name: `${recordId}/request.body`, body: Buffer.from('request') },
  { name: `${recordId}/response.body`, body: Buffer.from('response') },
] as const;

interface TarFixtureEntry {
  name: string;
  body?: Buffer;
  type?: 'file' | 'directory';
}

async function createTarGzip(entries: readonly TarFixtureEntry[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const pack = tar.pack();
  const completed = pipeline(
    pack as unknown as Readable,
    createGzip(),
    new Writable({
      write(chunk: Uint8Array, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    }),
  );
  for (const entry of entries) {
    const body = entry.body ?? Buffer.alloc(0);
    pack.entry({
      name: entry.name,
      type: entry.type ?? 'file',
      size: body.byteLength,
    }, body);
  }
  pack.finalize();
  await completed;
  return Buffer.concat(chunks);
}

test('accepts exactly one canonical regular file for every seeded archive part', async () => {
  const entries = await extractSeededRawCaptureTarGzip(
    await createTarGzip(canonicalEntries),
    recordId,
  );

  assert.deepEqual([...entries.keys()], canonicalEntries.map((entry) => entry.name));
  assert.deepEqual(entries.get(`${recordId}/request.body`), Buffer.from('request'));
  assert.deepEqual(entries.get(`${recordId}/response.body`), Buffer.from('response'));
});

test('rejects a duplicate canonical tar entry instead of overwriting it', async () => {
  await assert.rejects(
    extractSeededRawCaptureTarGzip(
      await createTarGzip([...canonicalEntries, canonicalEntries[1]]),
      recordId,
    ),
    /duplicate.*request\.body/i,
  );
});

test('rejects a non-regular canonical tar entry', async () => {
  const entries: TarFixtureEntry[] = canonicalEntries.map((entry) => ({ ...entry }));
  entries[0] = { name: `${recordId}/metadata.json`, type: 'directory' };
  await assert.rejects(
    extractSeededRawCaptureTarGzip(await createTarGzip(entries), recordId),
    /regular file.*metadata\.json/i,
  );
});

test('rejects an unexpected tar entry outside the canonical seeded set', async () => {
  await assert.rejects(
    extractSeededRawCaptureTarGzip(
      await createTarGzip([
        ...canonicalEntries,
        { name: `${recordId}/extra.txt`, body: Buffer.from('unexpected') },
      ]),
      recordId,
    ),
    /unexpected.*extra\.txt/i,
  );
});

test('rejects an archive missing any canonical seeded entry', async () => {
  await assert.rejects(
    extractSeededRawCaptureTarGzip(
      await createTarGzip(canonicalEntries.slice(0, 2)),
      recordId,
    ),
    /missing.*response\.body/i,
  );
});
