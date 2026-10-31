import type { Database } from '../data-platform/database';
import { exerciseName } from '../exercises/catalog';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const VOLUME_CHANGE_RATIO = 0.1;
const PLATEAU_SESSIONS = 3;

export type InsightData = {
  plannedPerWeek: number;
  workoutsThisWeek: number;
  workoutsLastWeek: number;
  volumeThisWeek: number;
  volumeLastWeek: number;
  plateauExercises: string[];
};

export type Insight = {
  id: string;
  title: string;
  body: string;
};

export function buildInsights(data: InsightData): Insight[] {
  const { plannedPerWeek, workoutsLastWeek, workoutsThisWeek, volumeLastWeek, volumeThisWeek } = data;
  const insights: Insight[] = [];

  if (workoutsThisWeek + workoutsLastWeek === 0) {
    return [
      {
        id: 'no-data',
        title: 'Пока мало данных',
        body: 'Подсказки появятся после первых завершённых тренировок.',
      },
    ];
  }

  insights.push({
    id: 'consistency',
    title: 'Регулярность',
    body:
      workoutsThisWeek >= plannedPerWeek
        ? `За 7 дней выполнено ${workoutsThisWeek} из ${plannedPerWeek} запланированных тренировок.`
        : `За 7 дней выполнено ${workoutsThisWeek} из ${plannedPerWeek} запланированных тренировок. Если план не подходит, его можно изменить в профиле.`,
  });

  if (volumeLastWeek > 0) {
    const change = (volumeThisWeek - volumeLastWeek) / volumeLastWeek;
    if (Math.abs(change) >= VOLUME_CHANGE_RATIO) {
      insights.push({
        id: 'volume',
        title: 'Объём нагрузки',
        body: `Объём за 7 дней ${change > 0 ? 'вырос' : 'снизился'} на ${Math.round(Math.abs(change) * 100)}% по сравнению с предыдущими 7 днями.`,
      });
    }
  }

  for (const exerciseId of data.plateauExercises) {
    insights.push({
      id: `plateau-${exerciseId}`,
      title: exerciseName(exerciseId),
      body: `Лучший вес не менялся ${PLATEAU_SESSIONS} тренировки подряд. Можно попробовать добавить повтор. Решение за вами.`,
    });
  }

  return insights;
}

async function weekStats(database: Database, from: Date, to: Date) {
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
  return { workouts: workouts?.count ?? 0, volume: volume?.volume ?? 0 };
}

async function findPlateaus(database: Database) {
  const rows = await database.all<{ exercise_id: string; session_id: string; top: number }>(
    `SELECT session_exercise.exercise_id, workout_session.id AS session_id,
            MAX(workout_set.weight_kg) AS top
     FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed' AND workout_set.kind != 'warmup'
       AND workout_set.weight_kg > 0
     GROUP BY session_exercise.exercise_id, workout_session.id
     ORDER BY workout_session.finished_at DESC`,
  );

  const recent = new Map<string, number[]>();
  for (const row of rows) {
    const tops = recent.get(row.exercise_id) ?? [];
    if (tops.length < PLATEAU_SESSIONS) {
      tops.push(row.top);
    }
    recent.set(row.exercise_id, tops);
  }

  return [...recent.entries()]
    .filter(([, tops]) => tops.length === PLATEAU_SESSIONS && new Set(tops).size === 1)
    .map(([exerciseId]) => exerciseId);
}

export async function getInsightData(
  database: Database,
  plannedPerWeek: number,
  now: Date,
): Promise<InsightData> {
  const weekAgo = new Date(now.getTime() - WEEK_MS);
  const twoWeeksAgo = new Date(now.getTime() - 2 * WEEK_MS);
  const [thisWeek, lastWeek, plateauExercises] = await Promise.all([
    weekStats(database, weekAgo, now),
    weekStats(database, twoWeeksAgo, weekAgo),
    findPlateaus(database),
  ]);

  return {
    plannedPerWeek,
    workoutsThisWeek: thisWeek.workouts,
    workoutsLastWeek: lastWeek.workouts,
    volumeThisWeek: thisWeek.volume,
    volumeLastWeek: lastWeek.volume,
    plateauExercises,
  };
}
