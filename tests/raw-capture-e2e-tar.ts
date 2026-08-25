import { Readable, type Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import * as tar from 'tar-stream';

export async function extractSeededRawCaptureTarGzip(
  bytes: Buffer,
  recordId: string,
): Promise<Map<string, Buffer>> {
  const expectedNames = new Set([
    `${recordId}/metadata.json`,
    `${recordId}/request.body`,
    `${recordId}/response.body`,
  ]);
  const entries = new Map<string, Buffer>();
  const extract = tar.extract();
  let validationError: Error | null = null;
  extract.on('entry', (header, stream, next) => {
    const rejectEntry = (error: Error): void => {
      validationError ??= error;
      stream.resume();
      stream.once('end', next);
    };
    if (!expectedNames.has(header.name)) {
      return rejectEntry(new Error(`unexpected tar entry: ${header.name}`));
    }
    if (entries.has(header.name)) {
      return rejectEntry(new Error(`duplicate tar entry: ${header.name}`));
    }
    if (header.type !== 'file') {
      return rejectEntry(new Error(`tar entry must be a regular file: ${header.name}`));
    }
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
  if (validationError) throw validationError;
  const missing = [...expectedNames].filter((name) => !entries.has(name));
  if (missing.length > 0) throw new Error(`missing tar entries: ${missing.join(', ')}`);
  return entries;
}
