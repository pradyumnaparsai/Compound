// Minimal typing for Node's built-in SQLite (no @types/node in this project). Test-only.
declare module 'node:sqlite' {
  type Value = string | number | null | bigint;
  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): {
      run(...p: Value[]): { changes: number | bigint; lastInsertRowid: number | bigint };
      get(...p: Value[]): unknown;
      all(...p: Value[]): unknown[];
    };
  }
}
