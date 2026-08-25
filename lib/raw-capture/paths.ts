import { lstatSync, mkdirSync, realpathSync, statSync, type Stats } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === ''
    || (pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot));
}

export function resolveWithinRoot(root: string, ...segments: string[]): string {
  const resolvedRoot = resolve(root);
  const result = resolve(resolvedRoot, ...segments);
  if (isWithin(resolvedRoot, result)) return result;
  throw new Error('原始数据路径无效');
}

function assertSimpleSegments(segments: readonly string[]): void {
  for (const segment of segments) {
    if (!segment || segment === '.' || segment === '..' || basename(segment) !== segment) {
      throw new Error('原始数据 managed 路径无效');
    }
  }
}

function canonicalManagedRoot(root: string): { resolvedRoot: string; realRoot: string } {
  const resolvedRoot = resolve(root);
  mkdirSync(resolvedRoot, { recursive: true });
  const rootInfo = statSync(resolvedRoot);
  if (!rootInfo.isDirectory()) throw new Error('原始数据根路径不是目录');
  return { resolvedRoot, realRoot: realpathSync(resolvedRoot) };
}

function assertDirectoryComponent(path: string, realRoot: string): void {
  const info = lstatSync(path);
  if (info.isSymbolicLink() || !info.isDirectory()) {
    throw new Error(`原始数据 managed 目录安全检查失败：${basename(path)} 不是普通目录或是符号链接`);
  }
  const realPath = realpathSync(path);
  if (!isWithin(realRoot, realPath)) throw new Error('原始数据 managed 目录逃逸根路径');
}

/**
 * Creates managed child directories one component at a time. The configured root
 * itself may intentionally be a symlink, but no application-owned child may be.
 */
export function ensureManagedDirectory(root: string, ...segments: string[]): string {
  assertSimpleSegments(segments);
  const { resolvedRoot, realRoot } = canonicalManagedRoot(root);
  let current = resolvedRoot;
  for (const segment of segments) {
    current = resolveWithinRoot(resolvedRoot, relative(resolvedRoot, current), segment);
    try {
      assertDirectoryComponent(current, realRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      mkdirSync(current, { mode: 0o700 });
      assertDirectoryComponent(current, realRoot);
    }
  }
  return current;
}

export function assertManagedDirectory(root: string, ...segments: string[]): string {
  assertSimpleSegments(segments);
  const { resolvedRoot, realRoot } = canonicalManagedRoot(root);
  let current = resolvedRoot;
  for (const segment of segments) {
    current = resolveWithinRoot(resolvedRoot, relative(resolvedRoot, current), segment);
    assertDirectoryComponent(current, realRoot);
  }
  return current;
}

/** Returns a lexically contained file path after validating every managed parent. */
export function managedFilePath(root: string, ...segments: string[]): string {
  assertSimpleSegments(segments);
  if (segments.length === 0) throw new Error('原始数据 managed 文件路径无效');
  const target = resolveWithinRoot(root, ...segments);
  const parentRelative = relative(resolve(root), dirname(target));
  const parents = parentRelative === '' ? [] : parentRelative.split(sep);
  assertManagedDirectory(root, ...parents);
  return target;
}

/** Validates all parents plus an exact, non-symlink regular file. */
export function assertManagedRegularFile(root: string, ...segments: string[]): { path: string; stats: Stats } {
  const path = managedFilePath(root, ...segments);
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`原始数据文件安全检查失败：${basename(path)} 不是普通文件或是符号链接`);
  }
  const { realRoot } = canonicalManagedRoot(root);
  if (!isWithin(realRoot, realpathSync(path))) throw new Error('原始数据文件逃逸根路径');
  return { path, stats };
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
