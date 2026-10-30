import type { Database } from './database';

export type Migration = {
  version: number;
  name: string;
  statements: string[];
};

export class DatabaseTooNewError extends Error {
  constructor(version: number) {
    super(`Database schema version ${version} is newer than this app supports`);
    this.name = 'DatabaseTooNewError';
  }
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    statements: [
      `CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE profile (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        name TEXT NOT NULL,
        sex TEXT CHECK (sex IN ('male', 'female')),
        age INTEGER NOT NULL CHECK (age >= 18),
        weight_kg REAL,
        goal TEXT NOT NULL,
        experience TEXT NOT NULL,
        days_per_week INTEGER NOT NULL,
        session_minutes INTEGER NOT NULL,
        equipment TEXT NOT NULL,
        limitations TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE program_day (
        id TEXT PRIMARY KEY,
        position INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL
      )`,
      `CREATE TABLE program_exercise (
        id TEXT PRIMARY KEY,
        program_day_id TEXT NOT NULL REFERENCES program_day(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        target_sets INTEGER NOT NULL,
        reps_min INTEGER NOT NULL,
        reps_max INTEGER NOT NULL,
        UNIQUE (program_day_id, position)
      )`,
      `CREATE TABLE workout_session (
        id TEXT PRIMARY KEY,
        program_day_id TEXT,
        title TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('planned', 'active', 'paused', 'completed', 'cancelled')),
        started_at TEXT NOT NULL,
        paused_at TEXT,
        paused_ms INTEGER NOT NULL DEFAULT 0,
        finished_at TEXT,
        last_activity_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX one_open_session ON workout_session ((1))
        WHERE state IN ('active', 'paused')`,
      `CREATE TABLE session_exercise (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        planned_sets INTEGER,
        reps_min INTEGER,
        reps_max INTEGER,
        UNIQUE (session_id, position)
      )`,
      `CREATE TABLE workout_set (
        id TEXT PRIMARY KEY,
        session_exercise_id TEXT NOT NULL REFERENCES session_exercise(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        weight_kg REAL,
        reps INTEGER NOT NULL CHECK (reps > 0),
        rir INTEGER,
        completed_at TEXT NOT NULL,
        UNIQUE (session_exercise_id, position)
      )`,
      `CREATE TABLE workout_event (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        operation_id TEXT NOT NULL UNIQUE,
        session_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      )`,
      'CREATE INDEX workout_set_by_exercise ON workout_set (session_exercise_id)',
      'CREATE INDEX session_exercise_by_exercise ON session_exercise (exercise_id)',
      'CREATE INDEX workout_session_by_state ON workout_session (state, finished_at)',
    ],
  },
];

export async function migrate(database: Database, available: Migration[] = migrations) {
  await database.run(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const applied = await database.all<{ version: number }>('SELECT version FROM schema_migrations');
  const appliedVersions = new Set(applied.map(({ version }) => version));
  const latestKnown = Math.max(0, ...available.map(({ version }) => version));
  const unknown = applied.find(({ version }) => version > latestKnown);
  if (unknown) {
    throw new DatabaseTooNewError(unknown.version);
  }

  const pending = available
    .filter(({ version }) => !appliedVersions.has(version))
    .sort((first, second) => first.version - second.version);

  for (const migration of pending) {
    await database.transaction(async (tx) => {
      for (const statement of migration.statements) {
        await tx.run(statement);
      }
      await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        new Date().toISOString(),
      ]);
    });
  }
}
