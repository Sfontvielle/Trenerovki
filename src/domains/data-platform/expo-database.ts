import * as SQLite from 'expo-sqlite';

import type { Database, DatabaseExecutor, SqlValue } from './database';
import { createQueue } from './write-queue';

const DATABASE_NAME = 'ironvant.db';

export async function openAppDatabase(): Promise<Database> {
  const connection = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await connection.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  // withTransactionAsync is not exclusive: any query issued meanwhile joins the
  // transaction and can see rows that are later rolled back. Every query waits
  // its turn, while transaction bodies use the raw executor and cannot deadlock.
  const enqueue = createQueue();

  const executor: DatabaseExecutor = {
    run: async (sql: string, params: SqlValue[] = []) => {
      await connection.runAsync(sql, params);
    },
    all: <Row>(sql: string, params: SqlValue[] = []) => connection.getAllAsync<Row>(sql, params),
    first: <Row>(sql: string, params: SqlValue[] = []) => connection.getFirstAsync<Row>(sql, params),
  };

  return {
    run: (sql, params) => enqueue(() => executor.run(sql, params)),
    all: <Row>(sql: string, params?: SqlValue[]) => enqueue(() => executor.all<Row>(sql, params)),
    first: <Row>(sql: string, params?: SqlValue[]) => enqueue(() => executor.first<Row>(sql, params)),
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
