import type { Database } from '@/domains/data-platform/database';
import { migrate } from '@/domains/data-platform/migrations';
import { exerciseName, exercises } from '@/domains/exercises/catalog';
import { completeOnboarding } from '@/domains/profile/complete-onboarding';
import {
  type Equipment,
  type Experience,
  type Goal,
  type Limitation,
  type Profile,
  allowedDaysPerWeek,
  allowedSessionMinutes,
  isValidAge,
  isValidName,
  isValidWeight,
} from '@/domains/profile/profile';
import { getProfile } from '@/domains/profile/profile-repository';
import { generatePlan } from '@/domains/program/generate-plan';
import { getNextDay, getProgram } from '@/domains/program/program-repository';
import {
  getExerciseRecords,
  getExerciseTrend,
  getSummary,
  listCompletedSessions,
} from '@/domains/progress/progress-repository';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

let nextId = 0;
const createId = () => `id-${++nextId}`;
const DAY_MS = 24 * 60 * 60 * 1000;
const START = Date.parse('2026-11-01T10:00:00.000Z');

const profile: Profile = {
  name: 'Ислам',
  sex: null,
  age: 30,
  weightKg: 80,
  goal: 'muscle',
  experience: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: 'gym',
  limitations: [],
};

describe('catalog', () => {
  it('has unique ids', () => {
    expect(new Set(exercises.map(({ id }) => id)).size).toBe(exercises.length);
  });

  it('names an unknown exercise honestly', () => {
    expect(exerciseName('removed')).toBe('Неизвестное упражнение');
  });
});

describe('profile validation', () => {
  it('requires a name', () => {
    expect(isValidName('  ')).toBe(false);
    expect(isValidName('Ислам')).toBe(true);
  });

  it('allows adults only', () => {
    expect(isValidAge(17)).toBe(false);
    expect(isValidAge(18)).toBe(true);
    expect(isValidAge(null)).toBe(false);
    expect(isValidAge(20.5)).toBe(false);
  });

  it('treats weight as optional but rejects nonsense', () => {
    expect(isValidWeight(null)).toBe(true);
    expect(isValidWeight(80.5)).toBe(true);
    expect(isValidWeight(5)).toBe(false);
  });
});

describe('generatePlan', () => {
  const goals: Goal[] = ['muscle', 'fat_loss', 'recomposition', 'strength', 'maintenance'];
  const levels: Experience[] = ['beginner', 'intermediate', 'advanced'];
  const equipment: Equipment[] = ['gym', 'dumbbells', 'bodyweight'];
  const limitationSets: Limitation[][] = [
    [],
    ['shoulders'],
    ['knees'],
    ['lower_back'],
    ['shoulders', 'knees', 'lower_back'],
  ];

  const combinations = allowedDaysPerWeek.flatMap((daysPerWeek) =>
    allowedSessionMinutes.flatMap((sessionMinutes) =>
      equipment.flatMap((gear) => limitationSets.map((limitations) => ({ daysPerWeek, sessionMinutes, gear, limitations }))),
    ),
  );

  it('builds a usable plan for every combination', () => {
    for (const { daysPerWeek, sessionMinutes, gear, limitations } of combinations) {
      for (const goal of goals) {
        for (const experience of levels) {
          const plan = generatePlan({ goal, experience, daysPerWeek, sessionMinutes, equipment: gear, limitations });

          expect(plan.length).toBeGreaterThan(0);
          for (const day of plan) {
            const ids = day.exercises.map(({ exerciseId }) => exerciseId);
            expect(ids.length).toBeGreaterThan(0);
            expect(new Set(ids).size).toBe(ids.length);
          }
        }
      }
    }
  });

  it('respects equipment and limitations', () => {
    for (const { daysPerWeek, sessionMinutes, gear, limitations } of combinations) {
      const plan = generatePlan({ goal: 'muscle', experience: 'beginner', daysPerWeek, sessionMinutes, equipment: gear, limitations });

      for (const { exerciseId } of plan.flatMap((day) => day.exercises)) {
        const exercise = exercises.find(({ id }) => id === exerciseId)!;
        expect(exercise.equipment).toContain(gear);
        expect(exercise.loads.filter((area) => limitations.includes(area))).toEqual([]);
      }
    }
  });

  it('matches the number of days and the session length', () => {
    const plan = generatePlan({ ...profile, daysPerWeek: 4, sessionMinutes: 30 });

    expect(plan).toHaveLength(4);
    expect(plan.every((day) => day.exercises.length <= 3)).toBe(true);
  });

  it('uses low reps for strength and more sets for advanced lifters', () => {
    const [day] = generatePlan({ ...profile, goal: 'strength', experience: 'advanced' });

    expect(day.exercises[0]).toMatchObject({ targetSets: 4, repsMin: 4, repsMax: 6 });
  });
});

describe('onboarding, rotation and progress', () => {
  async function setup() {
    const database: Database = createTestDatabase();
    await migrate(database);
    const clock = { time: START };
    const engine = new WorkoutEngine({ database, createId, now: () => new Date(clock.time) });
    await completeOnboarding(database, profile, generatePlan(profile), createId, new Date(START));
    return { database, clock, engine };
  }

  async function finishWorkout(
    engine: WorkoutEngine,
    programDayId: string | null,
    sets: { weightKg: number | null; reps: number }[],
  ) {
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Тренировка',
      programDayId,
      exercises: [{ exerciseId: 'bench-press', plannedSets: 3, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    for (const set of sets) {
      await engine.logSet(session!.exercises[0].id, { ...set, rir: null }, createId());
    }
    await engine.completeSession(sessionId, createId());
    return sessionId;
  }

  it('stores the profile and the plan together', async () => {
    const { database } = await setup();

    expect(await getProfile(database)).toMatchObject({ name: 'Ислам', limitations: [] });
    expect(await getProgram(database)).toHaveLength(3);
  });

  it('stores nothing when saving the plan fails', async () => {
    const database = createTestDatabase();
    await migrate(database);
    const invalid = [{ name: 'День', exercises: [{ exerciseId: 'x', targetSets: 3, repsMin: 8, repsMax: 12 }] }];
    const failingId = () => 'same-id';

    await expect(
      completeOnboarding(database, profile, [invalid[0], invalid[0]], failingId, new Date(START)),
    ).rejects.toThrow();

    expect(await getProfile(database)).toBeNull();
  });

  it('rotates to the next program day after a workout', async () => {
    const { clock, database, engine } = await setup();
    const program = await getProgram(database);

    expect((await getNextDay(database, program))?.id).toBe(program[0].id);

    await finishWorkout(engine, program[0].id, [{ weightKg: 80, reps: 8 }]);
    expect((await getNextDay(database, program))?.id).toBe(program[1].id);

    clock.time += DAY_MS;
    await finishWorkout(engine, program[2].id, [{ weightKg: 80, reps: 8 }]);
    expect((await getNextDay(database, program))?.id).toBe(program[0].id);
  });

  it('summarises only completed workouts', async () => {
    const { clock, database, engine } = await setup();
    await finishWorkout(engine, null, [{ weightKg: 80, reps: 10 }, { weightKg: null, reps: 10 }]);
    clock.time += 10 * DAY_MS;
    await finishWorkout(engine, null, [{ weightKg: 100, reps: 5 }]);
    const cancelled = await engine.startSession({
      operationId: createId(),
      title: 'Отмена',
      programDayId: null,
      exercises: [],
    });
    await engine.cancelSession(cancelled, createId());

    expect(await getSummary(database, new Date(clock.time))).toEqual({
      completedWorkouts: 2,
      workoutsLastWeek: 1,
      totalVolumeKg: 1300,
    });
    const sessions = await listCompletedSessions(database);
    expect(sessions.map(({ setCount, volumeKg }) => [setCount, volumeKg])).toEqual([
      [1, 500],
      [2, 800],
    ]);
  });

  it('reports an empty state honestly', async () => {
    const { database } = await setup();

    expect(await getSummary(database, new Date(START))).toEqual({
      completedWorkouts: 0,
      workoutsLastWeek: 0,
      totalVolumeKg: 0,
    });
    expect(await getExerciseRecords(database)).toEqual([]);
  });

  it('finds records and the trend of an exercise', async () => {
    const { clock, database, engine } = await setup();
    await finishWorkout(engine, null, [{ weightKg: 80, reps: 8 }, { weightKg: 85, reps: 5 }]);
    clock.time += DAY_MS;
    await finishWorkout(engine, null, [{ weightKg: 85, reps: 6 }]);

    const [record] = await getExerciseRecords(database);
    expect(record).toMatchObject({ exerciseId: 'bench-press', bestWeightKg: 85, repsAtBest: 6 });

    const trend = await getExerciseTrend(database, 'bench-press');
    expect(trend.map(({ topWeightKg, volumeKg }) => [topWeightKg, volumeKg])).toEqual([
      [85, 1065],
      [85, 510],
    ]);
  });
});
