export interface ActivityChartDay {
  day: string;
  requests: number;
  effective_tokens: number;
  cost: number;
}

export interface ChartPoint {
  x: number;
  y: number;
}

export interface ActivityCalendar {
  weeks: Array<Array<ActivityChartDay | null>>;
  months: Array<{ label: string; week: number }>;
}

export function chartY(value: number, max: number, top: number, bottom: number): number {
  if (!Number.isFinite(max) || max <= 0) return bottom;
  const normalized = Math.min(max, Math.max(0, value)) / max;
  return bottom - normalized * (bottom - top);
}

export function monthLabelGridColumn(week: number, weekCount: number): string {
  const start = Math.min(Math.max(0, week), Math.max(0, weekCount - 1)) + 1;
  const end = Math.min(start + 3, weekCount + 1);
  return `${start} / ${Math.max(start + 1, end)}`;
}

const DAY_MS = 86_400_000;

function parseLocalDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** 按星期日到星期六排列；最后一周始终位于最右侧。 */
export function buildActivityCalendar(data: ActivityChartDay[]): ActivityCalendar {
  if (!data.length) return { weeks: [], months: [] };

  const byDay = new Map(data.map((item) => [item.day, item]));
  const first = parseLocalDay(data[0].day);
  const last = parseLocalDay(data[data.length - 1].day);
  const firstWeekStart = new Date(first.getFullYear(), first.getMonth(), first.getDate() - first.getDay());
  const elapsedDays = Math.round((last.getTime() - firstWeekStart.getTime()) / DAY_MS);
  const weekCount = Math.floor(elapsedDays / 7) + 1;
  const weeks = Array.from({ length: weekCount }, (_, week) =>
    Array.from({ length: 7 }, (_, weekday) => {
      const date = new Date(firstWeekStart.getFullYear(), firstWeekStart.getMonth(), firstWeekStart.getDate() + week * 7 + weekday);
      return byDay.get(dayKey(date)) ?? null;
    }),
  );

  const months = data
    .filter((item) => parseLocalDay(item.day).getDate() === 1)
    .map((item) => {
      const date = parseLocalDay(item.day);
      const week = Math.floor(Math.round((date.getTime() - firstWeekStart.getTime()) / DAY_MS) / 7);
      return { label: `${date.getMonth() + 1}月`, week };
    });

  return { weeks, months };
}

export function nearestTrendIndex(pointerX: number, left: number, right: number, count: number): number {
  if (count <= 0) return -1;
  if (count === 1 || right <= left) return 0;
  const ratio = Math.min(1, Math.max(0, (pointerX - left) / (right - left)));
  return Math.round(ratio * (count - 1));
}

/** Catmull-Rom 控制点转换为三次贝塞尔，经过每一个原始数据点。 */
export function smoothLinePath(points: ChartPoint[]): string {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const after = points[index + 2] ?? next;
    const segmentMinY = Math.min(current.y, next.y);
    const segmentMaxY = Math.max(current.y, next.y);
    const control1 = {
      x: current.x + (next.x - previous.x) / 6,
      y: Math.min(segmentMaxY, Math.max(segmentMinY, current.y + (next.y - previous.y) / 6)),
    };
    const control2 = {
      x: next.x - (after.x - current.x) / 6,
      y: Math.min(segmentMaxY, Math.max(segmentMinY, next.y - (after.y - current.y) / 6)),
    };
    path += ` C ${control1.x.toFixed(2)} ${control1.y.toFixed(2)}, ${control2.x.toFixed(2)} ${control2.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }
  return path;
}
