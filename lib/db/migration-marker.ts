import type Database from 'better-sqlite3';

/**
 * 一次性数据迁移的执行标记。
 *
 * 分清两类迁移很重要：
 *  - **结构迁移**（ADD COLUMN / CREATE TABLE）：每次启动都跑，靠 PRAGMA table_info 自检，便宜且无副作用；
 *  - **数据迁移**（改写已有行）：只能跑一次，跑第二次就是在覆盖用户数据。
 *
 * 后者需要一个持久化的「跑过了」标记。`schema_migrations` 表原本建在
 * usage-migration.ts 里、只有它自己在用；其它迁移想用得依赖"usage 排在第一个"
 * 这种隐式顺序。现在表建在 CREATE_TABLES_SQL 里，读写走这两个函数。
 */

export function hasAppliedMigration(sqlite: Database.Database, name: string): boolean {
  const row = sqlite.prepare('SELECT 1 AS ok FROM schema_migrations WHERE name = ?').get(name) as
    | { ok: number }
    | undefined;
  return row !== undefined;
}

export function markMigrationApplied(sqlite: Database.Database, name: string, appliedAt = Date.now()): void {
  sqlite
    .prepare('INSERT OR IGNORE INTO schema_migrations (name, applied_at) VALUES (?, ?)')
    .run(name, appliedAt);
}

/** 只在没跑过时执行 run()，执行成功后落标记。调用方负责事务。 */
export function runOnce(sqlite: Database.Database, name: string, run: () => void): boolean {
  if (hasAppliedMigration(sqlite, name)) return false;
  run();
  markMigrationApplied(sqlite, name);
  return true;
}
