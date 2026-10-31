import type { Database } from '@/domains/data-platform/database';
import { deleteAllData, exportAllData } from '@/domains/data-platform/data-transfer';
import { DatabaseTooNewError, type Migration, migrate, migrations } from '@/domains/data-platform/migrations';
import { SettingsRepository } from '@/domains/data-platform/settings-repository';
import { createTestDatabase } from '../../test-support/test-database';

async function tableNames(database: Database) {
  const rows = await database.all<{ name: string }>(
    "SELECT name FROM sqlite_master WHERE type = 'table'",
  );
  return rows.map(({ name }) => name);
}

describe('migrate', () => {
  it('creates the schema and records every version', async () => {
    const database = createTestDatabase();

    await migrate(database);

    expect(await tableNames(database)).toEqual(
      expect.arrayContaining(['profile', 'workout_session', 'workout_set', 'workout_event']),
    );
    const applied = await database.all<{ version: number }>('SELECT version FROM schema_migrations');
    expect(applied.map(({ version }) => version)).toEqual(migrations.map(({ version }) => version));
  });

  it('upgrades a version 1 database and keeps its workouts', async () => {
    const database = createTestDatabase();
    await migrate(database, migrations.slice(0, 1));
    await database.run(
      `INSERT INTO workout_session (id, title, state, started_at, last_activity_at)
       VALUES ('kept', 'Тренировка', 'completed', 'now', 'now')`,
    );

    await migrate(database);

    expect(await database.all('SELECT id FROM workout_session')).toEqual([{ id: 'kept' }]);
    expect(await tableNames(database)).toEqual(expect.arrayContaining(['food', 'food_entry']));
  });

  it('does nothing on a second run', async () => {
    const database = createTestDatabase();
    await migrate(database);
    await new SettingsRepository(database).set('accent', 'rose');

    await migrate(database);

    expect(await new SettingsRepository(database).get('accent')).toBe('rose');
  });

  it('rolls back a failed migration completely', async () => {
    const database = createTestDatabase();
    const broken: Migration = {
      version: 1,
      name: 'broken',
      statements: ['CREATE TABLE half_done (id TEXT)', 'THIS IS NOT SQL'],
    };

    await expect(migrate(database, [broken])).rejects.toThrow();

    expect(await tableNames(database)).not.toContain('half_done');
    expect(await database.all('SELECT version FROM schema_migrations')).toEqual([]);
  });

  it('applies only pending versions in order and keeps existing data', async () => {
    const database = createTestDatabase();
    const first: Migration = { version: 1, name: 'first', statements: ['CREATE TABLE note (id TEXT)'] };
    await migrate(database, [first]);
    await database.run("INSERT INTO note (id) VALUES ('kept')");
    const second: Migration = {
      version: 2,
      name: 'second',
      statements: ['ALTER TABLE note ADD COLUMN body TEXT'],
    };

    await migrate(database, [second, first]);

    expect(await database.all('SELECT * FROM note')).toEqual([{ id: 'kept', body: null }]);
  });

  it('keeps child rows when a migration rebuilds a parent table', async () => {
    const database = createTestDatabase();
    const schema: Migration = {
      version: 1,
      name: 'schema',
      statements: [
        'CREATE TABLE parent (id TEXT PRIMARY KEY, kind TEXT)',
        'CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id) ON DELETE CASCADE)',
      ],
    };
    await migrate(database, [schema]);
    await database.run("INSERT INTO parent VALUES ('session', 'a')");
    await database.run("INSERT INTO child VALUES ('set', 'session')");
    const rebuild: Migration = {
      version: 2,
      name: 'rebuild',
      rebuildsTables: true,
      statements: [
        'CREATE TABLE parent_new (id TEXT PRIMARY KEY, kind TEXT NOT NULL)',
        'INSERT INTO parent_new SELECT * FROM parent',
        'DROP TABLE parent',
        'ALTER TABLE parent_new RENAME TO parent',
      ],
    };

    await migrate(database, [schema, rebuild]);

    expect(await database.all('SELECT * FROM child')).toEqual([{ id: 'set', parent_id: 'session' }]);
    expect(await database.first('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
  });

  it('rolls back a rebuild that breaks foreign keys and restores enforcement', async () => {
    const database = createTestDatabase();
    const schema: Migration = {
      version: 1,
      name: 'schema',
      statements: [
        'CREATE TABLE parent (id TEXT PRIMARY KEY)',
        'CREATE TABLE child (id TEXT PRIMARY KEY, parent_id TEXT REFERENCES parent(id))',
      ],
    };
    await migrate(database, [schema]);
    await database.run("INSERT INTO parent VALUES ('session')");
    await database.run("INSERT INTO child VALUES ('set', 'session')");
    const broken: Migration = {
      version: 2,
      name: 'broken',
      rebuildsTables: true,
      statements: ['DELETE FROM parent'],
    };

    await expect(migrate(database, [schema, broken])).rejects.toThrow('broke foreign keys');

    expect(await database.all('SELECT * FROM parent')).toHaveLength(1);
    expect(await database.first('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
  });

  it('refuses a database created by a newer app version', async () => {
    const database = createTestDatabase();
    await migrate(database);
    await database.run(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (999, 'future', 'now')",
    );

    await expect(migrate(database)).rejects.toBeInstanceOf(DatabaseTooNewError);
  });
});

describe('data transfer', () => {
  it('exports and then deletes everything', async () => {
    const database = createTestDatabase();
    await migrate(database);
    await new SettingsRepository(database).set('accent', 'rose');

    const exported = JSON.parse(await exportAllData(database));
    expect(exported.format).toBe('ironvant-export');
    expect(exported.schemaVersion).toBe(migrations.at(-1)?.version);
    expect(Object.keys(exported.tables)).toEqual(
      expect.arrayContaining(['profile', 'workout_session', 'workout_set', 'workout_event']),
    );
    expect(exported.tables.settings).toHaveLength(1);

    await deleteAllData(database);
    expect(await new SettingsRepository(database).get('accent')).toBeNull();
    expect(await database.all('SELECT version FROM schema_migrations')).toHaveLength(migrations.length);
  });
});

describe('timed sets migration', () => {
  it('keeps recorded sets and plans, then allows sets without reps', async () => {
    const database = createTestDatabase();
    await migrate(database, migrations.filter(({ version }) => version <= 3));
    await database.run(
      `INSERT INTO workout_session (id, title, state, started_at, last_activity_at)
       VALUES ('s', 'Т', 'completed', '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
    );
    await database.run(
      "INSERT INTO session_exercise (id, session_id, position, exercise_id) VALUES ('e', 's', 1, 'bench-press')",
    );
    await database.run(
      `INSERT INTO workout_set (id, session_exercise_id, position, weight_kg, reps, completed_at)
       VALUES ('w', 'e', 1, 80, 8, '2026-01-01T00:00:00.000Z')`,
    );
    await database.run("INSERT INTO program_day (id, position, name) VALUES ('d', 1, 'День')");
    await database.run(
      `INSERT INTO program_exercise (id, program_day_id, position, exercise_id, target_sets, reps_min, reps_max)
       VALUES ('p', 'd', 1, 'bench-press', 3, 8, 12)`,
    );
    const snapshots: number[] = [];

    await migrate(database, migrations, {
      beforePending: async (version) => {
        snapshots.push(version);
      },
    });

    expect(snapshots).toEqual([3]);
    expect(await database.first('SELECT weight_kg, reps, duration_sec FROM workout_set')).toEqual({
      weight_kg: 80,
      reps: 8,
      duration_sec: null,
    });
    expect(await database.all('SELECT reps_min, target_duration_sec FROM program_exercise')).toEqual([
      { reps_min: 8, target_duration_sec: null },
    ]);
    await database.run(
      `INSERT INTO workout_set (id, session_exercise_id, position, duration_sec, completed_at)
       VALUES ('t', 'e', 2, 60, '2026-01-01T00:00:00.000Z')`,
    );
    await expect(
      database.run(
        `INSERT INTO workout_set (id, session_exercise_id, position, completed_at)
         VALUES ('x', 'e', 3, '2026-01-01T00:00:00.000Z')`,
      ),
    ).rejects.toThrow();
  });

  it('does not call the hook when nothing is pending', async () => {
    const database = createTestDatabase();
    await migrate(database);
    const beforePending = jest.fn();

    await migrate(database, migrations, { beforePending });

    expect(beforePending).not.toHaveBeenCalled();
  });

  it('exports what exists before the later tables are created', async () => {
    const database = createTestDatabase();
    await migrate(database, migrations.filter(({ version }) => version === 1));

    const backup = JSON.parse(await exportAllData(database));

    expect(Object.keys(backup.tables)).toContain('profile');
    expect(Object.keys(backup.tables)).not.toContain('food');
  });
});
