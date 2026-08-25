import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const inspectConfigScript = `
const config = (await import('./playwright.config.ts')).default;
const servers = Array.isArray(config.webServer) ? config.webServer : [config.webServer];
const appServer = servers.at(-1);
console.log(JSON.stringify({ baseURL: config.use?.baseURL, command: appServer?.command, url: appServer?.url }));
`;

interface ConfigLoadResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function loadPlaywrightConfig(overrides: Record<string, string>): ConfigLoadResult {
  const environment = { ...process.env };
  delete environment.PLAYWRIGHT_PORT;
  delete environment.PLAYWRIGHT_DB_DIR;
  Object.assign(environment, overrides);
  const result = spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--input-type=module', '--eval', inspectConfigScript],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: environment,
    },
  );
  return {
    status: result.status,
    stdout: String(result.stdout),
    stderr: String(result.stderr),
  };
}

test('Playwright config rejects unsafe or out-of-range ports during module load', () => {
  for (const port of ['3110; touch /tmp/model-center-injected', '31 10', '3e3', '1023', '65536']) {
    const result = loadPlaywrightConfig({ PLAYWRIGHT_PORT: port });
    assert.notEqual(result.status, 0, `unsafe port unexpectedly loaded: ${port}`);
    assert.match(result.stderr, /PLAYWRIGHT_PORT.*decimal.*1024.*65535/i);
  }
});

test('Playwright config creates one shell-safe isolated run directory per invocation', () => {
  const marker = '.next-playwright data; touch /tmp/model-center-db-injected';
  const first = loadPlaywrightConfig({
    PLAYWRIGHT_PORT: '3111',
    PLAYWRIGHT_DB_DIR: marker,
  });
  const second = loadPlaywrightConfig({
    PLAYWRIGHT_PORT: '3111',
    PLAYWRIGHT_DB_DIR: marker,
  });

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  const inspected = [first, second].map((result) => JSON.parse(result.stdout.trim()) as {
    baseURL: string;
    command: string;
    url: string;
  });
  const runIds = inspected.map((config) => {
    assert.equal(config.baseURL, 'http://127.0.0.1:3111');
    assert.equal(config.url, 'http://127.0.0.1:3111');
    assert.match(config.command, /--port 3111$/);
    assert.doesNotMatch(config.command, /model-center-db-injected/);

    const databaseAssignments = [...config.command.matchAll(/MODEL_CENTER_DB_DIR=([^\s]+)/g)]
      .map((match) => match[1]!);
    assert.equal(databaseAssignments.length, 2, 'seed and Next must share one database directory');
    assert.equal(databaseAssignments[0], databaseAssignments[1]);
    const matched = /^\.next-playwright-data\/([0-9a-f]{32})\/db$/.exec(databaseAssignments[0]!);
    assert.ok(matched, `unsafe database assignment: ${databaseAssignments[0]}`);
    const runId = matched[1]!;
    assert.match(
      config.command,
      new RegExp(`MODEL_CENTER_NEXT_DIST_DIR=\\.next-playwright-data/${runId}/next-dist(?:\\s|$)`),
    );
    assert.match(
      config.command,
      new RegExp(`MODEL_CENTER_NEXT_TSCONFIG=\\.next-playwright-data/${runId}/tsconfig\\.json(?:\\s|$)`),
    );
    return runId;
  });

  assert.notEqual(runIds[0], runIds[1], 'separate config invocations must never reuse a data directory');
});
