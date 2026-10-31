import type { Database } from './database';

const exportedTables = [
  'profile',
  'program_day',
  'program_exercise',
  'workout_session',
  'session_exercise',
  'workout_set',
  'workout_event',
  'food',
  'food_entry',
  'body_weight',
  'custom_exercise',
  'settings',
] as const;

const deletionOrder = [
  'custom_exercise',
  'body_weight',
  'food_entry',
  'food',
  'workout_event',
  'workout_set',
  'session_exercise',
  'workout_session',
  'program_exercise',
  'program_day',
  'profile',
  'settings',
] as const;

export async function exportAllData(database: Database) {
  const schema = await database.first<{ version: number }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  const tables: Record<string, unknown[]> = {};
  for (const table of exportedTables) {
    tables[table] = await database.all(`SELECT * FROM ${table}`);
  }
  return JSON.stringify(
    { format: 'ironvant-export', version: 1, schemaVersion: schema?.version ?? 0, tables },
    null,
    2,
  );
}

export type BackupProblem = 'not_a_backup' | 'too_new' | 'damaged';

export class BackupError extends Error {
  constructor(readonly problem: BackupProblem) {
    super(`Backup cannot be restored: ${problem}`);
    this.name = 'BackupError';
  }
}

type Row = Record<string, unknown>;

function readBackup(text: string) {
  let parsed: { format?: unknown; schemaVersion?: unknown; tables?: unknown };
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError('not_a_backup');
  }
  const { format, schemaVersion, tables } = parsed ?? {};
  if (format !== 'ironvant-export' || !Number.isInteger(schemaVersion) || typeof tables !== 'object' || !tables) {
    throw new BackupError('not_a_backup');
  }
  return { schemaVersion: schemaVersion as number, tables: tables as Record<string, unknown> };
}

function isCellValue(value: unknown): value is string | number | null {
  return value === null || typeof value === 'string' || typeof value === 'number';
}

// Everything happens in one transaction: a bad backup leaves current data intact.
export async function restoreAllData(database: Database, text: string) {
  const { schemaVersion, tables } = readBackup(text);
  const current = await database.first<{ version: number }>(
    'SELECT MAX(version) AS version FROM schema_migrations',
  );
  if (schemaVersion > (current?.version ?? 0)) {
    throw new BackupError('too_new');
  }
  if (!Array.isArray(tables.profile) || tables.profile.length !== 1) {
    throw new BackupError('damaged');
  }

  await database.transaction(async (tx) => {
    for (const table of deletionOrder) {
      await tx.run(`DELETE FROM ${table}`);
    }

    for (const table of exportedTables) {
      const rows = tables[table] ?? [];
      if (!Array.isArray(rows)) {
        throw new BackupError('damaged');
      }
      const columns = await tx.all<{ name: string }>(`PRAGMA table_info(${table})`);
      const known = new Set(columns.map(({ name }) => name));

      for (const row of rows as Row[]) {
        const keys = Object.keys(row ?? {});
        const values = keys.map((key) => row[key]);
        if (keys.length === 0 || !keys.every((key) => known.has(key)) || !values.every(isCellValue)) {
          throw new BackupError('damaged');
        }
        await tx.run(
          `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          values,
        );
      }
    }
  });
}

export async function deleteAllData(database: Database) {
  await database.transaction(async (tx) => {
    for (const table of deletionOrder) {
      await tx.run(`DELETE FROM ${table}`);
    }
  });
}
