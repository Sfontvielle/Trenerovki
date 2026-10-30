import type { Database } from '@/domains/data-platform/database';
import { openAppDatabase } from '@/domains/data-platform/expo-database';
import { migrate } from '@/domains/data-platform/migrations';
import { WorkoutEngine } from '@/domains/workout/workout-engine';

type Connection = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
  };
  close(): void;
};
type ConnectionClass = new (path: string, options?: { enableForeignKeyConstraints: boolean }) => Connection;

const mockState = { path: '', statements: [] as string[], connections: [] as Connection[] };

// Mirrors the real library: each call yields to the event loop, and
// withTransactionAsync lets other queries join the open transaction.
jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = jest.requireActual('node:sqlite') as { DatabaseSync: ConnectionClass };
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

  return {
    openDatabaseAsync: async () => {
      const connection = new DatabaseSync(mockState.path, { enableForeignKeyConstraints: false });
      mockState.connections.push(connection);
      const api = {
        execAsync: async (sql: string) => {
          mockState.statements.push(sql);
          await tick();
          connection.exec(sql);
        },
        runAsync: async (sql: string, params: unknown[] = []) => {
          await tick();
          connection.prepare(sql).run(...params);
        },
        getAllAsync: async (sql: string, params: unknown[] = []) => {
          await tick();
          return connection.prepare(sql).all(...params);
        },
        getFirstAsync: async (sql: string, params: unknown[] = []) => {
          await tick();
          return connection.prepare(sql).get(...params) ?? null;
        },
        withTransactionAsync: async (task: () => Promise<void>) => {
          await api.execAsync('BEGIN');
          try {
            await task();
            await api.execAsync('COMMIT');
          } catch (error) {
            await api.execAsync('ROLLBACK');
            throw error;
          }
        },
      };
      return api;
    },
  };
});

const { DatabaseSync } = jest.requireActual('node:sqlite') as { DatabaseSync: ConnectionClass };
const { mkdtempSync, rmSync } = jest.requireActual('node:fs') as {
  mkdtempSync(prefix: string): string;
  rmSync(path: string, options: { recursive: boolean; force: boolean }): void;
};
const { tmpdir } = jest.requireActual('node:os') as { tmpdir(): string };
const { join } = jest.requireActual('node:path') as { join(...parts: string[]): string };

let directory: string;
let database: Database;

function committedIds() {
  const reader = new DatabaseSync(mockState.path);
  const rows = reader.prepare('SELECT id FROM item ORDER BY id').all() as { id: string }[];
  reader.close();
  return rows.map(({ id }) => id);
}

beforeEach(async () => {
  directory = mkdtempSync(join(tmpdir(), 'ironvant-'));
  mockState.path = join(directory, 'test.db');
  mockState.statements = [];
  database = await openAppDatabase();
  await database.run('CREATE TABLE item (id TEXT PRIMARY KEY)');
});

afterEach(() => {
  for (const connection of mockState.connections.splice(0)) {
    connection.close();
  }
  rmSync(directory, { recursive: true, force: true });
});

describe('openAppDatabase', () => {
  it('turns on write-ahead logging and foreign keys', () => {
    expect(mockState.statements[0]).toMatch(/journal_mode = WAL/);
    expect(mockState.statements[0]).toMatch(/foreign_keys = ON/);
  });

  it('commits work that a second connection can read', async () => {
    await database.transaction((tx) => tx.run("INSERT INTO item VALUES ('saved')"));

    expect(committedIds()).toEqual(['saved']);
  });

  it('keeps a write issued during a failing transaction out of its rollback', async () => {
    let outside: Promise<void> | undefined;
    const failing = database.transaction(async (tx) => {
      await tx.run("INSERT INTO item VALUES ('rolled-back')");
      outside = database.run("INSERT INTO item VALUES ('kept')");
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error('commit failed');
    });

    await expect(failing).rejects.toThrow('commit failed');
    await outside;

    expect(committedIds()).toEqual(['kept']);
  });

  it('never lets a read see rows that are later rolled back', async () => {
    let read: Promise<unknown[]> | undefined;
    const failing = database.transaction(async (tx) => {
      await tx.run("INSERT INTO item VALUES ('phantom')");
      read = database.all('SELECT id FROM item');
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error('commit failed');
    });

    await expect(failing).rejects.toThrow('commit failed');

    expect(await read).toEqual([]);
  });

  it('keeps working after a failed transaction', async () => {
    await expect(
      database.transaction(async () => {
        throw new Error('failed');
      }),
    ).rejects.toThrow('failed');

    await database.run("INSERT INTO item VALUES ('after')");

    expect(committedIds()).toEqual(['after']);
  });

  it('runs overlapping transactions one after another', async () => {
    await Promise.all(
      ['a', 'b', 'c'].map((id) => database.transaction((tx) => tx.run('INSERT INTO item VALUES (?)', [id]))),
    );

    expect(committedIds()).toEqual(['a', 'b', 'c']);
  });

  it('numbers overlapping sets correctly', async () => {
    await migrate(database);
    let nextId = 0;
    const engine = new WorkoutEngine({ database, createId: () => `id-${++nextId}`, now: () => new Date() });
    const sessionId = await engine.startSession({
      operationId: 'start',
      title: 'Тренировка',
      programDayId: null,
      exercises: [{ exerciseId: 'bench-press', plannedSets: 3, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    const exerciseId = session!.exercises[0].id;

    await Promise.all(
      [1, 2, 3].map((reps) => engine.logSet(exerciseId, { weightKg: 50, reps, rir: null }, `set-${reps}`)),
    );

    const saved = await engine.getSession(sessionId);
    expect(saved?.exercises[0].sets.map(({ position }) => position)).toEqual([1, 2, 3]);
  });
});
