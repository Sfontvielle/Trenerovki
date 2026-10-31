import type { Database } from './database';

export type Migration = {
  version: number;
  name: string;
  statements: string[];
  // Required when a migration drops a table: with foreign keys on, DROP TABLE
  // cascades into child rows and silently deletes recorded sets.
  rebuildsTables?: boolean;
};

export class DatabaseDamagedError extends Error {
  constructor(details: string) {
    super(`Database failed its integrity check: ${details}`);
    this.name = 'DatabaseDamagedError';
  }
}

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
  {
    version: 2,
    name: 'nutrition diary',
    statements: [
      `CREATE TABLE food (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        kcal REAL NOT NULL,
        protein REAL NOT NULL,
        fat REAL NOT NULL,
        carbs REAL NOT NULL,
        last_used_at TEXT NOT NULL
      )`,
      `CREATE TABLE food_entry (
        id TEXT PRIMARY KEY,
        day TEXT NOT NULL,
        meal TEXT NOT NULL CHECK (meal IN ('breakfast', 'lunch', 'dinner', 'snack')),
        food_id TEXT NOT NULL,
        name TEXT NOT NULL,
        grams REAL NOT NULL CHECK (grams > 0),
        kcal REAL NOT NULL,
        protein REAL NOT NULL,
        fat REAL NOT NULL,
        carbs REAL NOT NULL,
        created_at TEXT NOT NULL
      )`,
      'CREATE INDEX food_entry_by_day ON food_entry (day)',
    ],
  },
  {
    version: 3,
    name: 'set details, body weight, schedule and custom exercises',
    statements: [
      `ALTER TABLE workout_set ADD COLUMN kind TEXT NOT NULL DEFAULT 'working'
        CHECK (kind IN ('working', 'warmup', 'drop', 'rest_pause'))`,
      'ALTER TABLE workout_set ADD COLUMN note TEXT',
      "ALTER TABLE profile ADD COLUMN training_days TEXT NOT NULL DEFAULT '[]'",
      `CREATE TABLE body_weight (
        day TEXT PRIMARY KEY,
        weight_kg REAL NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE custom_exercise (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        muscle_group TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 4,
    name: 'timed sets, exercise groups and session recovery',
    rebuildsTables: true,
    statements: [
      `CREATE TABLE workout_set_new (
        id TEXT PRIMARY KEY,
        session_exercise_id TEXT NOT NULL REFERENCES session_exercise(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        weight_kg REAL,
        reps INTEGER CHECK (reps IS NULL OR reps > 0),
        rir INTEGER,
        completed_at TEXT NOT NULL,
        kind TEXT NOT NULL DEFAULT 'working'
          CHECK (kind IN ('working', 'warmup', 'drop', 'rest_pause')),
        note TEXT,
        duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec > 0),
        distance_m REAL CHECK (distance_m IS NULL OR distance_m > 0),
        CHECK (reps IS NOT NULL OR duration_sec IS NOT NULL OR distance_m IS NOT NULL),
        UNIQUE (session_exercise_id, position)
      )`,
      `INSERT INTO workout_set_new
         (id, session_exercise_id, position, weight_kg, reps, rir, completed_at, kind, note)
       SELECT id, session_exercise_id, position, weight_kg, reps, rir, completed_at, kind, note
       FROM workout_set`,
      'DROP TABLE workout_set',
      'ALTER TABLE workout_set_new RENAME TO workout_set',
      'CREATE INDEX workout_set_by_exercise ON workout_set (session_exercise_id)',
      `CREATE TABLE program_exercise_new (
        id TEXT PRIMARY KEY,
        program_day_id TEXT NOT NULL REFERENCES program_day(id) ON DELETE CASCADE,
        position INTEGER NOT NULL,
        exercise_id TEXT NOT NULL,
        target_sets INTEGER NOT NULL,
        reps_min INTEGER,
        reps_max INTEGER,
        target_duration_sec INTEGER,
        group_id TEXT,
        UNIQUE (program_day_id, position)
      )`,
      `INSERT INTO program_exercise_new
         (id, program_day_id, position, exercise_id, target_sets, reps_min, reps_max)
       SELECT id, program_day_id, position, exercise_id, target_sets, reps_min, reps_max
       FROM program_exercise`,
      'DROP TABLE program_exercise',
      'ALTER TABLE program_exercise_new RENAME TO program_exercise',
      'ALTER TABLE session_exercise ADD COLUMN target_duration_sec INTEGER',
      'ALTER TABLE session_exercise ADD COLUMN group_id TEXT',
      'ALTER TABLE workout_session ADD COLUMN recovery_required INTEGER NOT NULL DEFAULT 0',
      "ALTER TABLE custom_exercise ADD COLUMN tracking TEXT NOT NULL DEFAULT 'reps'",
      "ALTER TABLE custom_exercise ADD COLUMN equipment TEXT NOT NULL DEFAULT '[]'",
    ],
  },
  {
    version: 5,
    name: 'recovery check-ins and steps',
    statements: [
      `CREATE TABLE daily_checkin (
        day TEXT PRIMARY KEY,
        sleep_hours REAL,
        sleep_quality INTEGER,
        energy INTEGER,
        soreness INTEGER,
        stress INTEGER,
        note TEXT,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE daily_steps (
        day TEXT PRIMARY KEY,
        steps INTEGER NOT NULL CHECK (steps >= 0),
        updated_at TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 6,
    name: 'coach proposals, plan versions and memory',
    statements: [
      `CREATE TABLE coach_proposal (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        fingerprint TEXT NOT NULL,
        title TEXT NOT NULL,
        why TEXT NOT NULL,
        change TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('open', 'accepted', 'rejected', 'deferred', 'undone')),
        created_at TEXT NOT NULL,
        decided_at TEXT,
        deferred_until TEXT,
        plan_version_id TEXT
      )`,
      'CREATE INDEX coach_proposal_by_fingerprint ON coach_proposal (fingerprint, status)',
      `CREATE TABLE plan_version (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        reason TEXT NOT NULL,
        snapshot TEXT NOT NULL
      )`,
      `CREATE TABLE coach_memory (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('fact', 'avoid_exercise')),
        text TEXT NOT NULL,
        exercise_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
    ],
  },
];

type MigrationHooks = {
  // Runs once before pending migrations, with the version the data is at now.
  beforePending?: (fromVersion: number) => Promise<void>;
};

export async function migrate(
  database: Database,
  available: Migration[] = migrations,
  { beforePending }: MigrationHooks = {},
) {
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

  if (pending.length === 0) {
    return;
  }

  const check = await database.first<{ integrity_check: string }>('PRAGMA integrity_check');
  if (check?.integrity_check !== 'ok') {
    throw new DatabaseDamagedError(check?.integrity_check ?? 'no result');
  }
  await beforePending?.(Math.max(0, ...appliedVersions));

  for (const migration of pending) {
    await applyMigration(database, migration);
  }
}

async function applyMigration(database: Database, migration: Migration) {
  // This pragma has no effect inside a transaction, so it wraps the transaction.
  if (migration.rebuildsTables) {
    await database.run('PRAGMA foreign_keys = OFF');
  }

  try {
    await database.transaction(async (tx) => {
      for (const statement of migration.statements) {
        await tx.run(statement);
      }
      if (migration.rebuildsTables) {
        const violations = await tx.all('PRAGMA foreign_key_check');
        if (violations.length > 0) {
          throw new Error(`Migration ${migration.version} broke foreign keys`);
        }
      }
      await tx.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        migration.version,
        migration.name,
        new Date().toISOString(),
      ]);
    });
  } finally {
    if (migration.rebuildsTables) {
      await database.run('PRAGMA foreign_keys = ON');
    }
  }
}
