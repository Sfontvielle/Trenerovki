import type { Database } from '../data-platform/database';
import { exerciseName } from '../exercises/catalog';
import { formatNumber } from '../../lib/format';
import { dayKey } from '../nutrition/nutrition';
import { t } from '@/lib/i18n';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const VOLUME_CHANGE_RATIO = 0.1;
const PLATEAU_SESSIONS = 3;
const PLATEAU_WINDOW_MS = 28 * DAY_MS;

export type InsightData = {
  averageSleepHours?: number | null;
  averageSteps?: number | null;
  foodDaysLogged?: number;
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
        title: t('Новых подсказок нет'),
        body: t('За последние 14 дней нет завершённых тренировок. Подсказки появятся после следующей.'),
      },
    ];
  }

  insights.push({
    id: 'consistency',
    title: t('Регулярность'),
    body:
      workoutsThisWeek >= plannedPerWeek
        ? t('За 7 дней завершено тренировок: {0}, по плану {1} в неделю.', { 0: workoutsThisWeek, 1: plannedPerWeek })
        : t('За 7 дней завершено тренировок: {0}, по плану {1} в неделю. Если план не подходит, упражнения можно изменить на вкладке «Тренировки».', { 0: workoutsThisWeek, 1: plannedPerWeek }),
  });

  if (volumeLastWeek > 0) {
    const change = (volumeThisWeek - volumeLastWeek) / volumeLastWeek;
    if (Math.abs(change) >= VOLUME_CHANGE_RATIO) {
      insights.push({
        id: 'volume',
        title: t('Суммарная нагрузка'),
        body: t('Сумма «вес × повторы» за 7 дней {0} на {1}% по сравнению с предыдущими 7 днями.', { 0: change > 0 ? t('выросла') : t('снизилась'), 1: Math.round(Math.abs(change) * 100) }),
      });
    }
  }

  for (const exerciseId of data.plateauExercises) {
    insights.push({
      id: `plateau-${exerciseId}`,
      title: exerciseName(exerciseId),
      body: t('Максимальный вес не менялся {0} тренировки подряд. Если подходы даются легко и боли нет, можно добавить один повтор. Решение за вами.', { 0: PLATEAU_SESSIONS }),
    });
  }

  if (data.averageSleepHours !== null && data.averageSleepHours !== undefined) {
    insights.push({
      id: 'sleep',
      title: t('Сон'),
      body: t('В среднем {0} ч по вашим отметкам за неделю. Это ваши записи, а не измерение датчиком.', { 0: formatNumber(data.averageSleepHours) }),
    });
  }

  if (data.averageSteps !== null && data.averageSteps !== undefined) {
    insights.push({
      id: 'steps',
      title: t('Шаги'),
      body: t('Шагов в день в среднем: {0}. Данные iPhone.', { 0: formatNumber(Math.round(data.averageSteps)) }),
    });
  }

  if (data.foodDaysLogged) {
    insights.push({
      id: 'food',
      title: t('Питание'),
      body: t('Дневник питания заполнен {0} из последних 7 дней.', { 0: data.foodDaysLogged }),
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

export async function findPlateaus(database: Database, since: Date) {
  const rows = await database.all<{ exercise_id: string; session_id: string; top: number }>(
    `SELECT session_exercise.exercise_id, workout_session.id AS session_id,
            MAX(workout_set.weight_kg) AS top
     FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed' AND workout_set.kind != 'warmup'
       AND workout_set.weight_kg > 0
       AND workout_session.finished_at >= ?
     GROUP BY session_exercise.exercise_id, workout_session.id
     ORDER BY workout_session.finished_at DESC`,
    [since.toISOString()],
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
  const [thisWeek, lastWeek, plateauExercises, sleep, steps, food] = await Promise.all([
    weekStats(database, weekAgo, now),
    weekStats(database, twoWeeksAgo, weekAgo),
    findPlateaus(database, new Date(now.getTime() - PLATEAU_WINDOW_MS)),
    database.first<{ average: number | null }>(
      'SELECT AVG(sleep_hours) AS average FROM daily_checkin WHERE day >= ?',
      [dayKey(weekAgo)],
    ),
    database.first<{ average: number | null }>(
      // Today is still being counted, so it would only lower the average.
      'SELECT AVG(steps) AS average FROM daily_steps WHERE day >= ? AND day < ?',
      [dayKey(weekAgo), dayKey(now)],
    ),
    database.first<{ count: number }>('SELECT COUNT(DISTINCT day) AS count FROM food_entry WHERE day >= ?', [
      dayKey(weekAgo),
    ]),
  ]);

  return {
    plannedPerWeek,
    workoutsThisWeek: thisWeek.workouts,
    workoutsLastWeek: lastWeek.workouts,
    volumeThisWeek: thisWeek.volume,
    volumeLastWeek: lastWeek.volume,
    plateauExercises,
    averageSleepHours: sleep?.average ?? null,
    averageSteps: steps?.average ?? null,
    foodDaysLogged: food?.count ?? 0,
  };
}
