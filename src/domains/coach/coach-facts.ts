import type { Database } from '../data-platform/database';
import type { MuscleGroup } from '../exercises/catalog';
import { findExercise } from '../exercises/catalog';
import { findPlateaus } from '../insights/local-insights';
import { dayKey, shiftDay } from '../nutrition/nutrition';
import { getProgram } from '../program/program-repository';
import type { Profile } from '../profile/profile';
import { assessReadiness } from '../recovery/recovery';
import { listCheckins } from '../recovery/recovery-repository';
import { getDeloadUntil, listAvoidedExercises } from './coach-repository';
import type { CoachFacts } from './proposals';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const PLATEAU_WINDOW_MS = 28 * DAY_MS;
const WEEKS_LOOKED_BACK = 6;
const READINESS_DAYS = 7;

async function workoutsByWeek(database: Database, now: Date) {
  const counts: number[] = [];
  for (let week = 0; week < WEEKS_LOOKED_BACK; week += 1) {
    const to = new Date(now.getTime() - week * WEEK_MS);
    const from = new Date(to.getTime() - WEEK_MS);
    const row = await database.first<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_session
       WHERE state = 'completed' AND finished_at > ? AND finished_at <= ?`,
      [from.toISOString(), to.toISOString()],
    );
    counts.push(row?.count ?? 0);
  }
  return counts;
}

async function setsByGroup(database: Database, now: Date) {
  const rows = await database.all<{ exercise_id: string; count: number }>(
    `SELECT session_exercise.exercise_id, COUNT(*) AS count FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed' AND workout_set.kind = 'working'
       AND workout_session.finished_at > ?
     GROUP BY session_exercise.exercise_id`,
    [new Date(now.getTime() - WEEK_MS).toISOString()],
  );
  const groups: Partial<Record<MuscleGroup, number>> = {};
  for (const { exercise_id, count } of rows) {
    const exercise = findExercise(exercise_id);
    if (exercise?.category === 'strength') {
      groups[exercise.muscleGroup] = (groups[exercise.muscleGroup] ?? 0) + count;
    }
  }
  return groups;
}

async function recentlyPainful(database: Database, now: Date) {
  const rows = await database.all<{ exercise_id: string }>(
    `SELECT DISTINCT json_extract(payload, '$.exerciseId') AS exercise_id FROM workout_event
     WHERE type = 'discomfort_reported' AND occurred_at >= ?`,
    [new Date(now.getTime() - 2 * WEEK_MS).toISOString()],
  );
  return rows.map(({ exercise_id }) => exercise_id);
}

async function weeksSinceFirstWorkout(database: Database, now: Date) {
  const row = await database.first<{ first: string | null }>(
    "SELECT MIN(finished_at) AS first FROM workout_session WHERE state = 'completed'",
  );
  return row?.first ? Math.floor((now.getTime() - Date.parse(row.first)) / WEEK_MS) : 0;
}

export async function readCoachFacts(database: Database, profile: Profile, now: Date): Promise<CoachFacts> {
  const today = dayKey(now);
  const [program, discomfort, plateaus, avoided, weeks, weeklySetsByGroup, deloadUntil, checkins, weeksOfHistory] = await Promise.all([
    getProgram(database),
    recentlyPainful(database, now),
    findPlateaus(database, new Date(now.getTime() - PLATEAU_WINDOW_MS)),
    listAvoidedExercises(database),
    workoutsByWeek(database, now),
    setsByGroup(database, now),
    getDeloadUntil(database),
    listCheckins(database, READINESS_DAYS),
    weeksSinceFirstWorkout(database, now),
  ]);

  // Only the last week counts: an old check-in says nothing about today.
  const weekStart = shiftDay(today, 1 - READINESS_DAYS);
  const lowReadinessDays = checkins.filter(
    (checkin) => checkin.day >= weekStart && assessReadiness(checkin, 0)?.level === 'low',
  ).length;

  return {
    today,
    program,
    profile,
    discomfort,
    plateaus,
    avoided,
    workoutsByWeek: weeks,
    weeksOfHistory,
    lowReadinessDays,
    weeklySetsByGroup,
    deloadUntil,
  };
}
