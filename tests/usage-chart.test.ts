import assert from 'node:assert/strict';
import test from 'node:test';

// Node 22 strip-types 直接执行测试时要求显式 .ts 扩展名。
import { buildActivityCalendar, chartY, monthLabelGridColumn, nearestTrendIndex, smoothLinePath } from '../lib/services/usage-chart.ts';

function activityDay(day: string, effectiveTokens = 0) {
  return { day, requests: effectiveTokens ? 1 : 0, effective_tokens: effectiveTokens, cost: 0 };
}

test('aligns activity by calendar week with the latest/current week at the far right', () => {
  const calendar = buildActivityCalendar([
    activityDay('2026-08-20', 10),
    activityDay('2026-08-21'),
    activityDay('2026-08-22'),
    activityDay('2026-08-23', 20),
    activityDay('2026-08-24', 30),
  ]);

  assert.equal(calendar.weeks.length, 2);
  assert.equal(calendar.weeks[0][4]?.day, '2026-08-20');
  assert.equal(calendar.weeks[1][0]?.day, '2026-08-23');
  assert.equal(calendar.weeks.at(-1)?.[1]?.day, '2026-08-24');
});

test('places month labels below the week containing the first day of each month', () => {
  const calendar = buildActivityCalendar([
    activityDay('2026-07-30'),
    activityDay('2026-07-31'),
    activityDay('2026-08-01'),
    activityDay('2026-08-02'),
    activityDay('2026-08-03'),
  ]);

  assert.deepEqual(calendar.months, [{ label: '8月', week: 0 }]);
});

test('finds the nearest trend bucket and clamps to chart bounds', () => {
  assert.equal(nearestTrendIndex(-20, 50, 900, 5), 0);
  assert.equal(nearestTrendIndex(500, 50, 900, 5), 2);
  assert.equal(nearestTrendIndex(1200, 50, 900, 5), 4);
  assert.equal(nearestTrendIndex(500, 50, 900, 0), -1);
});

test('builds a smooth cubic path through chart points', () => {
  assert.equal(smoothLinePath([]), '');
  assert.equal(smoothLinePath([{ x: 10, y: 20 }]), 'M 10.00 20.00');
  const path = smoothLinePath([{ x: 0, y: 10 }, { x: 10, y: 0 }, { x: 20, y: 10 }]);
  assert.match(path, /^M 0\.00 10\.00 C /);
  assert.match(path, /20\.00 10\.00$/);
});

test('keeps smooth curve controls within each segment to avoid dipping below zero', () => {
  const path = smoothLinePath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 100 }]);
  assert.match(path, /^M 0\.00 0\.00 C 1\.67 0\.00, 6\.67 0\.00, 10\.00 0\.00/);
  assert.doesNotMatch(path, /-16\.67/);
});

test('scales sub-dollar costs against the real cost axis maximum', () => {
  assert.ok(Math.abs(chartY(0.02, 0.0216, 22, 276) - 40.8148) < 0.01);
  assert.equal(chartY(0, 0, 22, 276), 276);
});

test('clamps month labels to the final available heatmap column', () => {
  assert.equal(monthLabelGridColumn(0, 53), '1 / 4');
  assert.equal(monthLabelGridColumn(51, 53), '52 / 54');
  assert.equal(monthLabelGridColumn(52, 53), '53 / 54');
});
