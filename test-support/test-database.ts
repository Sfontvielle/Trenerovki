import type { Database, DatabaseExecutor, SqlValue } from '@/domains/data-platform/database';
import { createQueue } from '@/domains/data-platform/write-queue';

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
  const enqueue = createQueue();

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
    run: (sql, params) => enqueue(() => executor.run(sql, params)),
    all: <Row>(sql: string, params?: SqlValue[]) => enqueue(() => executor.all<Row>(sql, params)),
    first: <Row>(sql: string, params?: SqlValue[]) => enqueue(() => executor.first<Row>(sql, params)),
    transaction: (task) =>
      enqueue(async () => {
        connection.exec('BEGIN');
        try {
          const result = await task(executor);
          connection.exec('COMMIT');
          return result;
        } catch (error) {
          connection.exec('ROLLBACK');
          throw error;
        }
      }),
  };
}
