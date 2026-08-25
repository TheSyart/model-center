import assert from 'node:assert/strict';
import test from 'node:test';

import {
  playwrightTypeScriptConfig,
  resolvePlaywrightArtifactPaths,
  seedTimestampForPreviousUtcDay,
} from './raw-capture-e2e-seed.ts';

test('seed timestamp selects previous UTC calendar day at safe midday across DST boundaries', () => {
  const startingTimezone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    const cases = [
      ['2026-03-09T00:30:00.000Z', '2026-03-08T12:00:00.000Z'],
      ['2026-11-02T00:30:00.000Z', '2026-11-01T12:00:00.000Z'],
    ] as const;
    for (const [startup, expected] of cases) {
      const actual = seedTimestampForPreviousUtcDay(Date.parse(startup));
      assert.equal(new Date(actual).toISOString(), expected);
    }
  } finally {
    if (startingTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = startingTimezone;
  }
});

test('seed accepts only a hexadecimal per-run database directory under the fixed artifact root', () => {
  const runId = '0123456789abcdef0123456789abcdef';
  assert.deepEqual(
    resolvePlaywrightArtifactPaths(`.next-playwright-data/${runId}/db`, '/workspace/model-center'),
    {
      artifactRoot: '/workspace/model-center/.next-playwright-data',
      runDir: `/workspace/model-center/.next-playwright-data/${runId}`,
      databaseDir: `/workspace/model-center/.next-playwright-data/${runId}/db`,
      tsconfigPath: `/workspace/model-center/.next-playwright-data/${runId}/tsconfig.json`,
    },
  );

  for (const unsafe of [
    '.next-playwright-data/db',
    '.next-playwright-data/not-hex/db',
    `.next-playwright-data/${runId}/other`,
    `/tmp/${runId}/db`,
    'data',
  ]) {
    assert.throws(
      () => resolvePlaywrightArtifactPaths(unsafe, '/workspace/model-center'),
      /isolated Playwright run directory/,
    );
  }
});

test('run-local TypeScript config resolves aliases from the repository base URL', () => {
  const config = playwrightTypeScriptConfig();
  assert.deepEqual(config.compilerOptions, {
    baseUrl: '../..',
    paths: { '@/*': ['./*'] },
  });
  assert.equal(config.extends, '../../tsconfig.json');
  assert.ok(config.include.includes('next-dist/types/**/*.ts'));
});
