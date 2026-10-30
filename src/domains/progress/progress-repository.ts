import type { Database } from '../data-platform/database';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type ProgressSummary = {
  completedWorkouts: number;
  workoutsLastWeek: number;
  totalVolumeKg: number;
};

export type SessionSummary = {
  id: string;
  title: string;
  finishedAt: string;
  startedAt: string;
  pausedMs: number;
  setCount: number;
  volumeKg: number;
};

export type ExerciseRecord = {
  exerciseId: string;
  bestWeightKg: number | null;
  repsAtBest: number;
  lastPerformedAt: string;
};

export type ExerciseTrendPoint = {
  sessionId: string;
  finishedAt: string;
  topWeightKg: number | null;
  bestReps: number;
};

export async function getSummary(database: Database, now: Date): Promise<ProgressSummary> {
  const workouts = await database.first<{ completed: number; recent: number }>(
    `SELECT COUNT(*) AS completed, COUNT(CASE WHEN finished_at >= ? THEN 1 END) AS recent
     FROM workout_session WHERE state = 'completed'`,
    [new Date(now.getTime() - WEEK_MS).toISOString()],
  );
  const volume = await database.first<{ volume: number | null }>(
    `SELECT SUM(workout_set.weight_kg * workout_set.reps) AS volume FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed'`,
  );

  return {
    completedWorkouts: workouts?.completed ?? 0,
    workoutsLastWeek: workouts?.recent ?? 0,
    totalVolumeKg: volume?.volume ?? 0,
  };
}

export async function listCompletedSessions(database: Database): Promise<SessionSummary[]> {
  const rows = await database.all<{
    id: string;
    title: string;
    finished_at: string;
    started_at: string;
    paused_ms: number;
    set_count: number;
    volume: number | null;
  }>(
    `SELECT workout_session.id, workout_session.title, workout_session.finished_at,
            workout_session.started_at, workout_session.paused_ms,
            COUNT(workout_set.id) AS set_count,
            SUM(workout_set.weight_kg * workout_set.reps) AS volume
     FROM workout_session
     LEFT JOIN session_exercise ON session_exercise.session_id = workout_session.id
     LEFT JOIN workout_set ON workout_set.session_exercise_id = session_exercise.id
     WHERE workout_session.state = 'completed'
     GROUP BY workout_session.id
     ORDER BY workout_session.finished_at DESC`,
  );

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    finishedAt: row.finished_at,
    startedAt: row.started_at,
    pausedMs: row.paused_ms,
    setCount: row.set_count,
    volumeKg: row.volume ?? 0,
  }));
}

export async function getExerciseRecords(database: Database): Promise<ExerciseRecord[]> {
  const rows = await database.all<{
    exercise_id: string;
    weight_kg: number | null;
    reps: number;
    finished_at: string;
  }>(
    `SELECT session_exercise.exercise_id, workout_set.weight_kg, workout_set.reps,
            workout_session.finished_at
     FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed'`,
  );

  const records = new Map<string, ExerciseRecord>();
  for (const row of rows) {
    const current = records.get(row.exercise_id);
    const weight = row.weight_kg ?? 0;
    const currentWeight = current?.bestWeightKg ?? 0;
    const stronger =
      !current ||
      weight > currentWeight ||
      (weight === currentWeight && row.reps > current.repsAtBest);
    const lastPerformedAt =
      current && current.lastPerformedAt > row.finished_at
        ? current.lastPerformedAt
        : row.finished_at;

    records.set(row.exercise_id, {
      exerciseId: row.exercise_id,
      bestWeightKg: stronger ? row.weight_kg : current.bestWeightKg,
      repsAtBest: stronger ? row.reps : current.repsAtBest,
      lastPerformedAt,
    });
  }

  return [...records.values()].sort((first, second) =>
    second.lastPerformedAt.localeCompare(first.lastPerformedAt),
  );
}

export async function getExerciseTrend(
  database: Database,
  exerciseId: string,
  limit = 12,
): Promise<ExerciseTrendPoint[]> {
  const rows = await database.all<{
    session_id: string;
    finished_at: string;
    top_weight: number | null;
    best_reps: number;
  }>(
    `SELECT workout_session.id AS session_id, workout_session.finished_at,
            MAX(workout_set.weight_kg) AS top_weight,
            MAX(workout_set.reps) AS best_reps
     FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed' AND session_exercise.exercise_id = ?
     GROUP BY workout_session.id
     ORDER BY workout_session.finished_at DESC
     LIMIT ?`,
    [exerciseId, limit],
  );

  return rows.reverse().map((row) => ({
    sessionId: row.session_id,
    finishedAt: row.finished_at,
    topWeightKg: row.top_weight,
    bestReps: row.best_reps,
  }));
}
