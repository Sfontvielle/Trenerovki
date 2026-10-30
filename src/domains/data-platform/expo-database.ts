import * as SQLite from 'expo-sqlite';

import type { Database, DatabaseExecutor, SqlValue } from './database';

const DATABASE_NAME = 'ironvant.db';

// withTransactionAsync is not exclusive: any query issued meanwhile joins the
// transaction, so every write goes through one queue.
function createWriteQueue() {
  let tail: Promise<unknown> = Promise.resolve();

  return function enqueue<Result>(task: () => Promise<Result>): Promise<Result> {
    const result = tail.then(task, task);
    tail = result.catch(() => undefined);
    return result;
  };
}

export async function openAppDatabase(): Promise<Database> {
  const connection = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await connection.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const enqueue = createWriteQueue();

  const executor: DatabaseExecutor = {
    run: async (sql: string, params: SqlValue[] = []) => {
      await connection.runAsync(sql, params);
    },
    all: <Row>(sql: string, params: SqlValue[] = []) => connection.getAllAsync<Row>(sql, params),
    first: <Row>(sql: string, params: SqlValue[] = []) => connection.getFirstAsync<Row>(sql, params),
  };

  return {
    ...executor,
    run: (sql, params) => enqueue(() => executor.run(sql, params)),
    transaction: <Result>(task: (tx: DatabaseExecutor) => Promise<Result>) =>
      enqueue(async () => {
        let result: Result | undefined;
        await connection.withTransactionAsync(async () => {
          result = await task(executor);
        });
        return result as Result;
      }),
  };
}
