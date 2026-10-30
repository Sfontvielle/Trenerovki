export type SqlValue = string | number | null;

export interface DatabaseExecutor {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<Row>(sql: string, params?: SqlValue[]): Promise<Row[]>;
  first<Row>(sql: string, params?: SqlValue[]): Promise<Row | null>;
}

export interface Database extends DatabaseExecutor {
  transaction<Result>(task: (tx: DatabaseExecutor) => Promise<Result>): Promise<Result>;
}
