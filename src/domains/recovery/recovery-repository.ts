import type { Database } from '../data-platform/database';
import type { Checkin, Rating } from './recovery';

const WORKOUT_WINDOW_MS = 2 * 24 * 60 * 60 * 1000;

type CheckinRow = {
  day: string;
  sleep_hours: number | null;
  sleep_quality: Rating | null;
  energy: Rating | null;
  soreness: Rating | null;
  stress: Rating | null;
  note: string | null;
};

function toCheckin(row: CheckinRow): Checkin {
  return {
    day: row.day,
    sleepHours: row.sleep_hours,
    sleepQuality: row.sleep_quality,
    energy: row.energy,
    soreness: row.soreness,
    stress: row.stress,
    note: row.note,
  };
}

export async function saveCheckin(database: Database, checkin: Checkin, now: Date) {
  await database.run(
    `INSERT INTO daily_checkin (day, sleep_hours, sleep_quality, energy, soreness, stress, note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (day) DO UPDATE SET
       sleep_hours = excluded.sleep_hours,
       sleep_quality = excluded.sleep_quality,
       energy = excluded.energy,
       soreness = excluded.soreness,
       stress = excluded.stress,
       note = excluded.note,
       updated_at = excluded.updated_at`,
    [
      checkin.day,
      checkin.sleepHours,
      checkin.sleepQuality,
      checkin.energy,
      checkin.soreness,
      checkin.stress,
      checkin.note,
      now.toISOString(),
    ],
  );
}

export async function getCheckin(database: Database, day: string) {
  const row = await database.first<CheckinRow>('SELECT * FROM daily_checkin WHERE day = ?', [day]);
  return row ? toCheckin(row) : null;
}

// Newest last, so charts read from left to right.
export async function listCheckins(database: Database, count: number) {
  const rows = await database.all<CheckinRow>('SELECT * FROM daily_checkin ORDER BY day DESC LIMIT ?', [count]);
  return rows.map(toCheckin).reverse();
}

export async function saveSteps(database: Database, day: string, steps: number, now: Date) {
  await database.run(
    `INSERT INTO daily_steps (day, steps, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (day) DO UPDATE SET steps = excluded.steps, updated_at = excluded.updated_at`,
    [day, steps, now.toISOString()],
  );
}

export async function listSteps(database: Database, count: number) {
  const rows = await database.all<{ day: string; steps: number }>(
    'SELECT day, steps FROM daily_steps ORDER BY day DESC LIMIT ?',
    [count],
  );
  return rows.reverse();
}

export async function countRecentWorkouts(database: Database, now: Date) {
  const row = await database.first<{ count: number }>(
    `SELECT COUNT(*) AS count FROM workout_session WHERE state = 'completed' AND finished_at >= ?`,
    [new Date(now.getTime() - WORKOUT_WINDOW_MS).toISOString()],
  );
  return row?.count ?? 0;
}
