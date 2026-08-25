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

test('Playwright config uses a fixed isolated database directory and a validated port', () => {
  const marker = '.next-playwright data; touch /tmp/model-center-db-injected';
  const result = loadPlaywrightConfig({
    PLAYWRIGHT_PORT: '3111',
    PLAYWRIGHT_DB_DIR: marker,
  });

  assert.equal(result.status, 0, result.stderr);
  const inspected = JSON.parse(result.stdout.trim()) as {
    baseURL: string;
    command: string;
    url: string;
  };
  assert.equal(inspected.baseURL, 'http://127.0.0.1:3111');
  assert.equal(inspected.url, 'http://127.0.0.1:3111');
  assert.match(inspected.command, /MODEL_CENTER_DB_DIR=\.next-playwright-data/);
  assert.match(inspected.command, /--port 3111$/);
  assert.doesNotMatch(inspected.command, /model-center-db-injected/);
});
