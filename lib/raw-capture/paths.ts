import { isAbsolute, join, relative, resolve, sep } from 'node:path';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function resolveWithinRoot(root: string, ...segments: string[]): string {
  const resolvedRoot = resolve(root);
  const result = resolve(resolvedRoot, ...segments);
  const pathFromRoot = relative(resolvedRoot, result);
  if (pathFromRoot === '' || (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot))) {
    return result;
  }
  throw new Error('原始数据路径无效');
}

export function rawCaptureRoot(): string {
  const dataDir = process.env.MODEL_CENTER_DB_DIR || join(process.cwd(), 'data');
  return resolve(dataDir, 'raw-captures');
}

export function localDay(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) throw new Error('时间戳无效');
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function assertRecordId(id: string): string {
  if (!UUID_PATTERN.test(id)) throw new Error('记录 ID 无效');
  return id;
}

export function assertArchiveDay(day: string): string {
  if (!DAY_PATTERN.test(day)) throw new Error('日期无效');
  const [year, month, date] = day.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== date) {
    throw new Error('日期无效');
  }
  return day;
}

export function activeRecordDir(root: string, day: string, id: string): string {
  return resolveWithinRoot(root, 'active', assertArchiveDay(day), assertRecordId(id));
}

export function archivePath(root: string, day: string): string {
  return resolveWithinRoot(root, 'archives', `${assertArchiveDay(day)}.tar.gz`);
}
