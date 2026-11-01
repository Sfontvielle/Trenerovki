import type { Database } from '../data-platform/database';
import { type Muscle, findExercise } from '../exercises/catalog';

const HOUR_MS = 60 * 60 * 1000;
const RECOVERY_HOURS = 72;
const SETS_FOR_FULL_LOAD = 4;
const SECONDARY_SHARE = 0.5;

export type MuscleWork = {
  exerciseId: string;
  finishedAt: string;
  sets: number;
};

export type MuscleLoad = Partial<Record<Muscle, number>>;

// A rough picture of what was trained lately, from 0 to 1: more sets count for
// more and the mark fades over three days. It says nothing about the real state
// of a muscle, so the screen labels it as an estimate.
export function estimateMuscleLoad(work: MuscleWork[], now: Date): MuscleLoad {
  const load: MuscleLoad = {};

  const raise = (muscle: Muscle, value: number) => {
    load[muscle] = Math.max(load[muscle] ?? 0, value);
  };

  for (const { exerciseId, finishedAt, sets } of work) {
    const exercise = findExercise(exerciseId);
    const hoursPassed = (now.getTime() - new Date(finishedAt).getTime()) / HOUR_MS;
    const left = 1 - hoursPassed / RECOVERY_HOURS;
    if (!exercise || left <= 0 || left > 1) {
      continue;
    }
    const effort = Math.min(sets / SETS_FOR_FULL_LOAD, 1) * left;
    exercise.primary.forEach((muscle) => raise(muscle, effort));
    exercise.secondary.forEach((muscle) => raise(muscle, effort * SECONDARY_SHARE));
  }

  return load;
}

export async function listRecentWork(database: Database, now: Date): Promise<MuscleWork[]> {
  const rows = await database.all<{ exercise_id: string; finished_at: string; sets: number }>(
    `SELECT session_exercise.exercise_id, workout_session.finished_at, COUNT(workout_set.id) AS sets
     FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed' AND workout_session.finished_at >= ?
       AND workout_set.kind != 'warmup'
     GROUP BY workout_session.id, session_exercise.exercise_id`,
    [new Date(now.getTime() - RECOVERY_HOURS * HOUR_MS).toISOString()],
  );

  return rows.map((row) => ({ exerciseId: row.exercise_id, finishedAt: row.finished_at, sets: row.sets }));
}
