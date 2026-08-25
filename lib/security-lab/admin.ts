import { validateSecurityLabConfig } from './config.ts';
import type { SecurityLabConfig } from './live-types.ts';
import type { SecurityLabStore } from './store.ts';

export function saveSecurityLabConfigInput(
  store: SecurityLabStore,
  input: unknown,
  now = Date.now(),
): SecurityLabConfig {
  const config = validateSecurityLabConfig(input, now);
  return store.saveConfig(config);
}

function positiveInteger(value: string | null, fallback: number): number {
  if (value === null || !/^\d+$/.test(value)) return fallback;
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : fallback;
}

export function historyPagination(searchParams: URLSearchParams): { page: number; pageSize: number } {
  return {
    page: positiveInteger(searchParams.get('page'), 1),
    pageSize: Math.min(100, positiveInteger(searchParams.get('page_size'), 20)),
  };
}
