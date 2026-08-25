import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

import { createRawCaptureStore } from '../lib/raw-capture/store.ts';

const SEEDED_RECORD_ID = '22222222-2222-4222-8222-222222222222';

export function seedTimestampForPreviousUtcDay(startupTimestamp: number): number {
  const startup = new Date(startupTimestamp);
  if (!Number.isFinite(startup.getTime())) throw new Error('startup timestamp must be finite');
  return Date.UTC(
    startup.getUTCFullYear(),
    startup.getUTCMonth(),
    startup.getUTCDate() - 1,
    12,
  );
}

function writePlaywrightTypeScriptConfig(): void {
  const artifactDir = join(process.cwd(), '.next-playwright-data');
  mkdirSync(artifactDir, { recursive: true });
  writeFileSync(join(artifactDir, 'tsconfig.json'), `${JSON.stringify({
    extends: '../tsconfig.json',
    compilerOptions: {
      baseUrl: '..',
      paths: { '@/*': ['./*'] },
    },
    include: [
      '../next-env.d.ts',
      '../**/*.ts',
      '../**/*.tsx',
      'next-dist/types/**/*.ts',
    ],
    exclude: ['../node_modules'],
  }, null, 2)}\n`);
}

export async function seedPreviousDayCapture(): Promise<void> {
  const startupTimestamp = Date.now();
  const databaseDir = process.env.MODEL_CENTER_DB_DIR;
  if (!databaseDir) throw new Error('MODEL_CENTER_DB_DIR is required for the raw-capture E2E seed');

  writePlaywrightTypeScriptConfig();
  mkdirSync(databaseDir, { recursive: true });
  const database = new Database(join(databaseDir, 'model-center.db'));
  database.pragma('busy_timeout = 5000');
  try {
    const seededTimestamp = seedTimestampForPreviousUtcDay(startupTimestamp);
    const store = createRawCaptureStore(database, {
      rootDir: join(databaseDir, 'raw-captures'),
      now: () => seededTimestamp,
      id: () => SEEDED_RECORD_ID,
    });
    if (store.getRecord(SEEDED_RECORD_ID)) return;

    const session = await store.beginRecord({
      path: '/v1/messages',
      entryProtocol: 'anthropic',
      requestBody: Buffer.from('e2e-archive-request'),
    });
    await session.appendResponse(Buffer.from('e2e-archive-response'));
    await session.finish({
      status: 200,
      stream: false,
      contentType: 'application/octet-stream',
      complete: true,
    });
  } finally {
    database.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await seedPreviousDayCapture();
}
