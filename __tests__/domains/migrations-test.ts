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
    expect(exported.schemaVersion).toBe(1);
    expect(Object.keys(exported.tables)).toEqual(
      expect.arrayContaining(['profile', 'workout_session', 'workout_set', 'workout_event']),
    );
    expect(exported.tables.settings).toHaveLength(1);

    await deleteAllData(database);
    expect(await new SettingsRepository(database).get('accent')).toBeNull();
    expect(await database.all('SELECT version FROM schema_migrations')).toHaveLength(1);
  });
});
