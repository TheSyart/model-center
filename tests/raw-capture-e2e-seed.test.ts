import assert from 'node:assert/strict';
import test from 'node:test';

import { seedTimestampForPreviousUtcDay } from './raw-capture-e2e-seed.ts';

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
