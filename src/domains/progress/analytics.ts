import type { Database } from '../data-platform/database';
import { type MuscleGroup, findExercise } from '../exercises/catalog';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export type WeekPoint = {
  weeksAgo: number;
  workouts: number;
  volumeKg: number;
};

export async function listWeeks(database: Database, now: Date, count: number): Promise<WeekPoint[]> {
  const weeks: WeekPoint[] = [];
  for (let weeksAgo = count - 1; weeksAgo >= 0; weeksAgo -= 1) {
    const to = new Date(now.getTime() - weeksAgo * WEEK_MS);
    const from = new Date(to.getTime() - WEEK_MS);
    const range = [from.toISOString(), to.toISOString()];
    const workouts = await database.first<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_session
       WHERE state = 'completed' AND finished_at > ? AND finished_at <= ?`,
      range,
    );
    const volume = await database.first<{ volume: number | null }>(
      `SELECT SUM(workout_set.weight_kg * workout_set.reps) AS volume FROM workout_set
       JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
       JOIN workout_session ON workout_session.id = session_exercise.session_id
       WHERE workout_session.state = 'completed' AND workout_set.kind != 'warmup'
         AND workout_session.finished_at > ? AND workout_session.finished_at <= ?`,
      range,
    );
    weeks.push({ weeksAgo, workouts: workouts?.count ?? 0, volumeKg: volume?.volume ?? 0 });
  }
  return weeks;
}

// Counts finished weeks backwards, so a quiet current week does not break it yet.
export function weeksInARow(weeks: WeekPoint[]) {
  const newestFirst = [...weeks].sort((first, second) => first.weeksAgo - second.weeksAgo);
  const started = newestFirst[0]?.workouts ? newestFirst : newestFirst.slice(1);
  const gap = started.findIndex(({ workouts }) => workouts === 0);
  return gap === -1 ? started.length : gap;
}

export type GroupSets = {
  group: MuscleGroup;
  sets: number;
};

export async function listSetsByGroup(database: Database, since: Date): Promise<GroupSets[]> {
  const rows = await database.all<{ exercise_id: string; count: number }>(
    `SELECT session_exercise.exercise_id, COUNT(*) AS count FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed' AND workout_set.kind != 'warmup'
       AND workout_session.finished_at > ?
     GROUP BY session_exercise.exercise_id`,
    [since.toISOString()],
  );
  const totals = new Map<MuscleGroup, number>();
  for (const { exercise_id, count } of rows) {
    const exercise = findExercise(exercise_id);
    if (exercise && exercise.category !== 'mobility' && exercise.category !== 'cardio') {
      totals.set(exercise.muscleGroup, (totals.get(exercise.muscleGroup) ?? 0) + count);
    }
  }
  return [...totals.entries()]
    .map(([group, sets]) => ({ group, sets }))
    .sort((first, second) => second.sets - first.sets);
}

export async function getCardioTotals(database: Database, since: Date) {
  const row = await database.first<{ seconds: number | null; meters: number | null }>(
    `SELECT SUM(workout_set.duration_sec) AS seconds, SUM(workout_set.distance_m) AS meters
     FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed' AND workout_set.distance_m IS NOT NULL
       AND workout_session.finished_at > ?`,
    [since.toISOString()],
  );
  return { seconds: row?.seconds ?? 0, meters: row?.meters ?? 0 };
}

export function average(values: number[]) {
  return values.length === 0 ? null : values.reduce((total, value) => total + value, 0) / values.length;
}
