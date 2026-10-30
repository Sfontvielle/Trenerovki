import type { Database } from './database';

const exportedTables = [
  'profile',
  'program_day',
  'program_exercise',
  'workout_session',
  'session_exercise',
  'workout_set',
  'workout_event',
  'settings',
] as const;

const deletionOrder = [
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

export async function deleteAllData(database: Database) {
  await database.transaction(async (tx) => {
    for (const table of deletionOrder) {
      await tx.run(`DELETE FROM ${table}`);
    }
  });
}
