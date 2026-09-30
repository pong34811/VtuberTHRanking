import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

// Actual SQLite execution with sequential, rollback-capable D1 batches.
// No network, credentials, files on disk, or production bindings are used.
export function createSqliteD1({ through = '9999', migrate = true } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  if (migrate) {
    const directory = new URL('../../migrations/', import.meta.url);
    for (const name of readdirSync(directory).filter(name => name.endsWith('.sql') && name.slice(0, 4) <= through).sort()) {
      sqlite.exec(readFileSync(new URL(name, directory), 'utf8'));
    }
  }
  const calls = [];
  let failure = null;
  const execute = (statement, operation) => {
    const call = { sql: statement.sql, values: statement.values, operation };
    calls.push(call);
    if (failure?.(call)) throw new Error('Injected transactional SQL failure');
    if (statement.values.length > 100) throw new Error('D1 bound parameter limit exceeded');
    if (new TextEncoder().encode(statement.sql).length > 100_000) throw new Error('D1 SQL statement limit exceeded');
    const prepared = sqlite.prepare(statement.sql);
    if (operation === 'first') return prepared.get(...statement.values) ?? null;
    if (operation === 'all' || /\bRETURNING\b/i.test(statement.sql)) return { success: true, results: prepared.all(...statement.values) };
    const result = prepared.run(...statement.values);
    return { success: true, results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } };
  };
  const db = {
    prepare(sql) {
      return {
        sql, values: [],
        bind(...values) { return { ...this, values }; },
        async first(column) { const row = execute(this, 'first'); return column ? row?.[column] ?? null : row; },
        async all() { return execute(this, 'all'); },
        async run() { return execute(this, 'run'); },
      };
    },
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => execute(statement, 'run'));
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
    async exec(sql) { sqlite.exec(sql); return { count: 1, duration: 0 }; },
  };
  return {
    db, sqlite, calls,
    injectFailure(predicate) { failure = predicate; },
    close() { sqlite.close(); },
  };
}
