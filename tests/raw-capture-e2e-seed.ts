import {
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

import { createRawCaptureStore } from '../lib/raw-capture/store.ts';

const SEEDED_RECORD_ID = '22222222-2222-4222-8222-222222222222';
const RUN_ID_PATTERN = /^[0-9a-f]{32}$/;

export interface PlaywrightArtifactPaths {
  artifactRoot: string;
  runDir: string;
  databaseDir: string;
  tsconfigPath: string;
}

export function resolvePlaywrightArtifactPaths(
  databaseDir: string,
  workingDirectory = process.cwd(),
): PlaywrightArtifactPaths {
  const artifactRoot = resolve(workingDirectory, '.next-playwright-data');
  const resolvedDatabaseDir = resolve(workingDirectory, databaseDir);
  const relativeDatabaseDir = relative(artifactRoot, resolvedDatabaseDir);
  const segments = relativeDatabaseDir.split(sep);
  if (
    isAbsolute(relativeDatabaseDir)
    || segments.length !== 2
    || !RUN_ID_PATTERN.test(segments[0]!)
    || segments[1] !== 'db'
  ) {
    throw new Error('MODEL_CENTER_DB_DIR must be an isolated Playwright run directory');
  }
  const runDir = join(artifactRoot, segments[0]!);
  return {
    artifactRoot,
    runDir,
    databaseDir: resolvedDatabaseDir,
    tsconfigPath: join(runDir, 'tsconfig.json'),
  };
}

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

function assertOrdinaryDirectory(path: string): void {
  const info = lstatSync(path);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`unsafe Playwright artifact directory: ${path}`);
  }
}

function ensureOrdinaryDirectory(path: string, recursive = false): void {
  try {
    mkdirSync(path, { recursive, mode: 0o700 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  assertOrdinaryDirectory(path);
}

export function playwrightTypeScriptConfig() {
  return {
    extends: '../../tsconfig.json',
    compilerOptions: {
      baseUrl: '../..',
      paths: { '@/*': ['./*'] },
    },
    include: [
      '../../next-env.d.ts',
      '../../app/**/*.ts',
      '../../app/**/*.tsx',
      '../../components/**/*.ts',
      '../../components/**/*.tsx',
      '../../lib/**/*.ts',
      '../../lib/**/*.tsx',
      '../../instrumentation.ts',
      'next-dist/types/**/*.ts',
    ],
    exclude: ['../../node_modules'],
  };
}

function writePlaywrightTypeScriptConfig(paths: PlaywrightArtifactPaths): void {
  ensureOrdinaryDirectory(paths.artifactRoot, true);
  ensureOrdinaryDirectory(paths.runDir);
  ensureOrdinaryDirectory(paths.databaseDir);
  const realArtifactRoot = realpathSync(paths.artifactRoot);
  for (const managedPath of [paths.runDir, paths.databaseDir]) {
    const relativePath = relative(realArtifactRoot, realpathSync(managedPath));
    if (isAbsolute(relativePath) || relativePath === '..' || relativePath.startsWith(`..${sep}`)) {
      throw new Error('unsafe Playwright artifact directory containment');
    }
  }

  const contents = `${JSON.stringify(playwrightTypeScriptConfig(), null, 2)}\n`;
  try {
    writeFileSync(paths.tsconfigPath, contents, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    const info = lstatSync(paths.tsconfigPath);
    if (info.isSymbolicLink() || !info.isFile() || readFileSync(paths.tsconfigPath, 'utf8') !== contents) {
      throw new Error('unsafe existing Playwright TypeScript config');
    }
  }
}

export async function seedPreviousDayCapture(): Promise<void> {
  const startupTimestamp = Date.now();
  const databaseDir = process.env.MODEL_CENTER_DB_DIR;
  if (!databaseDir) throw new Error('MODEL_CENTER_DB_DIR is required for the raw-capture E2E seed');
  const artifactPaths = resolvePlaywrightArtifactPaths(databaseDir);

  writePlaywrightTypeScriptConfig(artifactPaths);
  const database = new Database(join(artifactPaths.databaseDir, 'model-center.db'));
  database.pragma('busy_timeout = 5000');
  try {
    const seededTimestamp = seedTimestampForPreviousUtcDay(startupTimestamp);
    const store = createRawCaptureStore(database, {
      rootDir: join(artifactPaths.databaseDir, 'raw-captures'),
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
