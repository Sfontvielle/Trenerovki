import type { Database, DatabaseExecutor, SqlValue } from '@/domains/data-platform/database';

type NodeStatement = {
  run(...params: SqlValue[]): unknown;
  all(...params: SqlValue[]): unknown[];
  get(...params: SqlValue[]): unknown;
};

type NodeDatabase = {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
};

export function createTestDatabase(path = ':memory:'): Database {
  const { DatabaseSync } = jest.requireActual('node:sqlite') as {
    DatabaseSync: new (path: string) => NodeDatabase;
  };
  const connection = new DatabaseSync(path);
  connection.exec('PRAGMA foreign_keys = ON');

  const executor: DatabaseExecutor = {
    run: async (sql, params = []) => {
      connection.prepare(sql).run(...params);
    },
    all: async <Row>(sql: string, params: SqlValue[] = []) =>
      connection.prepare(sql).all(...params) as Row[],
    first: async <Row>(sql: string, params: SqlValue[] = []) =>
      (connection.prepare(sql).get(...params) as Row | undefined) ?? null,
  };

  return {
    ...executor,
    transaction: async (task) => {
      connection.exec('BEGIN');
      try {
        const result = await task(executor);
        connection.exec('COMMIT');
        return result;
      } catch (error) {
        connection.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
