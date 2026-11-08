// A tiny expo-sqlite look-alike over Node's built-in SQLite (node:sqlite), so migrations and repositories can be
// tested against a real SQL engine without a native module. Test-only.
import { DatabaseSync } from 'node:sqlite';

type Params = (string | number | null)[];
const norm = (p: unknown[]): Params => ((p.length === 1 && Array.isArray(p[0]) ? p[0] : p) as Params).map((v) => (v === undefined ? null : v));

export interface NodeDb {
  raw: DatabaseSync;
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...p: unknown[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(sql: string, ...p: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...p: unknown[]): Promise<T[]>;
  withExclusiveTransactionAsync(fn: (tx: NodeDb) => Promise<void>): Promise<void>;
}

export function createNodeDb(): NodeDb {
  const raw = new DatabaseSync(':memory:');
  const api: NodeDb = {
    raw,
    async execAsync(sql: string) {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...p: unknown[]) {
      const r = raw.prepare(sql).run(...norm(p));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    async getFirstAsync<T>(sql: string, ...p: unknown[]): Promise<T | null> {
      return (raw.prepare(sql).get(...norm(p)) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...p: unknown[]): Promise<T[]> {
      return raw.prepare(sql).all(...norm(p)) as T[];
    },
    async withExclusiveTransactionAsync(fn) {
      raw.exec('BEGIN');
      try {
        await fn(api);
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return api;
}
