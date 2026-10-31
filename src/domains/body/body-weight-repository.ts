import type { Database } from '../data-platform/database';

export type BodyWeightEntry = {
  day: string;
  weightKg: number;
};

const CHART_LIMIT = 30;

export async function saveBodyWeight(database: Database, day: string, weightKg: number, now: Date) {
  await database.run(
    `INSERT INTO body_weight (day, weight_kg, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (day) DO UPDATE SET weight_kg = excluded.weight_kg, updated_at = excluded.updated_at`,
    [day, weightKg, now.toISOString()],
  );
}

export async function listBodyWeight(database: Database, limit = CHART_LIMIT): Promise<BodyWeightEntry[]> {
  const rows = await database.all<{ day: string; weight_kg: number }>(
    'SELECT day, weight_kg FROM body_weight ORDER BY day DESC LIMIT ?',
    [limit],
  );
  return rows.reverse().map((row) => ({ day: row.day, weightKg: row.weight_kg }));
}

export async function deleteBodyWeight(database: Database, day: string) {
  await database.run('DELETE FROM body_weight WHERE day = ?', [day]);
}
