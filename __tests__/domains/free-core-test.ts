import { deleteBodyWeight, listBodyWeight, saveBodyWeight } from '@/domains/body/body-weight-repository';
import type { Database } from '@/domains/data-platform/database';
import { BackupError, exportAllData, restoreAllData } from '@/domains/data-platform/data-transfer';
import { migrate, migrations } from '@/domains/data-platform/migrations';
import { exerciseName, registerCustomExerciseNames } from '@/domains/exercises/catalog';
import { addCustomExercise, listCustomExercises } from '@/domains/exercises/custom-exercise-repository';
import { buildInsights, getInsightData } from '@/domains/insights/local-insights';
import { logFood } from '@/domains/nutrition/nutrition-repository';
import { completeOnboarding } from '@/domains/profile/complete-onboarding';
import type { Profile } from '@/domains/profile/profile';
import { getProfile } from '@/domains/profile/profile-repository';
import { generatePlan } from '@/domains/program/generate-plan';
import {
  addProgramExercise,
  getProgram,
  removeProgramExercise,
  replaceProgramExercise,
} from '@/domains/program/program-repository';
import { scheduleHeading } from '@/domains/program/schedule';
import { getExerciseRecords, getSummary } from '@/domains/progress/progress-repository';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

let nextId = 0;
const createId = () => `id-${++nextId}`;
const NOW = new Date('2026-11-04T10:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

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
  trainingDays: [1, 3, 5],
};

async function setup() {
  const database: Database = createTestDatabase();
  await migrate(database);
  const clock = { time: NOW.getTime() };
  const engine = new WorkoutEngine({ database, createId, now: () => new Date(clock.time) });
  await completeOnboarding(database, profile, generatePlan(profile), createId, NOW);
  return { database, clock, engine };
}

async function finishWorkout(
  engine: WorkoutEngine,
  sets: { weightKg: number; reps: number; kind?: 'working' | 'warmup' }[],
) {
  const sessionId = await engine.startSession({
    operationId: createId(),
    title: 'Тренировка',
    programDayId: null,
    exercises: [{ exerciseId: 'bench-press', plannedSets: 3, repsMin: 8, repsMax: 12 }],
  });
  const session = await engine.getSession(sessionId);
  for (const set of sets) {
    await engine.logSet(session!.exercises[0].id, { rir: null, ...set }, createId());
  }
  await engine.completeSession(sessionId, createId());
}

describe('set details', () => {
  it('stores the kind and the note', async () => {
    const { engine } = await setup();
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Т',
      programDayId: null,
      exercises: [{ exerciseId: 'bench-press', plannedSets: 1, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    const exerciseId = session!.exercises[0].id;

    const setId = await engine.logSet(
      exerciseId,
      { weightKg: 40, reps: 10, rir: null, kind: 'warmup', note: 'Лёгкая разминка' },
      createId(),
    );
    await engine.updateSet(setId, { weightKg: 45, reps: 10, rir: null, kind: 'drop', note: null }, createId());

    const saved = await engine.getSession(sessionId);
    expect(saved?.exercises[0].sets[0]).toMatchObject({ weightKg: 45, kind: 'drop', note: null });
  });

  it('rejects a note that is too long', async () => {
    const { engine } = await setup();
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Т',
      programDayId: null,
      exercises: [{ exerciseId: 'bench-press', plannedSets: 1, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);

    await expect(
      engine.logSet(session!.exercises[0].id, { weightKg: 40, reps: 10, rir: null, note: 'x'.repeat(201) }, createId()),
    ).rejects.toMatchObject({ code: 'invalid_set' });
  });

  it('keeps warm-ups out of volume and records', async () => {
    const { database, engine } = await setup();

    await finishWorkout(engine, [
      { weightKg: 100, reps: 10, kind: 'warmup' },
      { weightKg: 60, reps: 10 },
    ]);

    expect((await getSummary(database, new Date(NOW.getTime() + 1))).totalVolumeKg).toBe(600);
    expect((await getExerciseRecords(database))[0].bestWeightKg).toBe(60);
  });
});

describe('body weight', () => {
  it('keeps one value per day and lists oldest first', async () => {
    const { database } = await setup();

    await saveBodyWeight(database, '2026-11-02', 80, NOW);
    await saveBodyWeight(database, '2026-11-01', 81, NOW);
    await saveBodyWeight(database, '2026-11-02', 79.5, NOW);

    expect(await listBodyWeight(database)).toEqual([
      { day: '2026-11-01', weightKg: 81 },
      { day: '2026-11-02', weightKg: 79.5 },
    ]);
  });

  it('deletes a value', async () => {
    const { database } = await setup();
    await saveBodyWeight(database, '2026-11-02', 80, NOW);

    await deleteBodyWeight(database, '2026-11-02');

    expect(await listBodyWeight(database)).toEqual([]);
  });
});

describe('schedule', () => {
  const wednesday = new Date(2026, 10, 4, 12);
  const thursday = new Date(2026, 10, 5, 12);
  const sunday = new Date(2026, 10, 8, 12);

  it('falls back to the next workout without a schedule', () => {
    expect(scheduleHeading([], wednesday)).toBe('Следующая тренировка');
  });

  it('recognises a training day', () => {
    expect(scheduleHeading([1, 3, 5], wednesday)).toBe('Сегодня по плану');
  });

  it('names the next training day on a rest day', () => {
    expect(scheduleHeading([1, 3, 5], thursday)).toBe('Сегодня отдых. Следующая тренировка в пятницу');
    expect(scheduleHeading([1, 3, 5], sunday)).toBe('Сегодня отдых. Следующая тренировка в понедельник');
  });

  it('stores the chosen days in the profile', async () => {
    const { database } = await setup();

    expect((await getProfile(database))?.trainingDays).toEqual([1, 3, 5]);
  });
});

describe('editing the plan', () => {
  it('replaces, adds and removes exercises', async () => {
    const { database } = await setup();
    const [day] = await getProgram(database);
    const [first] = day.exercises;

    await replaceProgramExercise(database, first.id, 'leg-press');
    await addProgramExercise(database, day.id, 'crunch', createId());
    await removeProgramExercise(database, first.id);

    const [edited] = await getProgram(database);
    const ids = edited.exercises.map(({ exerciseId }) => exerciseId);
    expect(ids).not.toContain('leg-press');
    expect(ids.at(-1)).toBe('crunch');
    const positions = await database.all<{ position: number }>(
      'SELECT position FROM program_exercise WHERE program_day_id = ? ORDER BY position',
      [day.id],
    );
    expect(positions.map(({ position }) => position)).toEqual(
      Array.from({ length: positions.length }, (_, index) => index + 1),
    );
  });
});

describe('custom exercises', () => {
  it('stores and names a custom exercise', async () => {
    const { database } = await setup();

    await addCustomExercise(database, { id: 'custom-1', name: ' Жим в смите ', muscleGroup: 'chest' }, NOW);
    const custom = await listCustomExercises(database);
    registerCustomExerciseNames(custom);

    expect(custom).toEqual([{ id: 'custom-1', name: 'Жим в смите', muscleGroup: 'chest' }]);
    expect(exerciseName('custom-1')).toBe('Жим в смите');
  });
});

describe('insights', () => {
  const base = {
    plannedPerWeek: 3,
    workoutsThisWeek: 2,
    workoutsLastWeek: 2,
    volumeThisWeek: 1000,
    volumeLastWeek: 1000,
    plateauExercises: [],
  };

  it('says so when there is no data', () => {
    const insights = buildInsights({ ...base, workoutsThisWeek: 0, workoutsLastWeek: 0 });

    expect(insights.map(({ id }) => id)).toEqual(['no-data']);
  });

  it('reports consistency against the plan', () => {
    expect(buildInsights(base)[0].body).toContain('2 из 3');
  });

  it('reports a real volume change only', () => {
    expect(buildInsights(base).some(({ id }) => id === 'volume')).toBe(false);
    const insights = buildInsights({ ...base, volumeThisWeek: 1300 });
    expect(insights.find(({ id }) => id === 'volume')?.body).toContain('вырос на 30%');
  });

  it('finds an exercise stuck at the same weight', async () => {
    const { clock, database, engine } = await setup();
    for (let index = 0; index < 3; index += 1) {
      await finishWorkout(engine, [{ weightKg: 80, reps: 8 }]);
      clock.time += DAY_MS;
    }

    const data = await getInsightData(database, 3, new Date(clock.time));

    expect(data.plateauExercises).toEqual(['bench-press']);
    expect(data.workoutsThisWeek).toBe(3);
  });

  it('does not call rising weights a plateau', async () => {
    const { clock, database, engine } = await setup();
    for (const weightKg of [70, 75, 80]) {
      await finishWorkout(engine, [{ weightKg, reps: 8 }]);
      clock.time += DAY_MS;
    }

    const data = await getInsightData(database, 3, new Date(clock.time));

    expect(data.plateauExercises).toEqual([]);
  });
});

describe('backup', () => {
  async function seedData() {
    const context = await setup();
    await finishWorkout(context.engine, [{ weightKg: 80, reps: 8 }]);
    await logFood(context.database, {
      entryId: 'entry',
      foodId: 'oats',
      name: 'Овсянка',
      per100g: { kcal: 366, protein: 12, fat: 6, carbs: 62 },
      grams: 50,
      day: '2026-11-04',
      meal: 'breakfast',
      now: NOW,
    });
    await saveBodyWeight(context.database, '2026-11-04', 80, NOW);
    await addCustomExercise(context.database, { id: 'custom-1', name: 'Своё', muscleGroup: 'chest' }, NOW);
    return context;
  }

  it('restores everything into an empty database', async () => {
    const { database } = await seedData();
    const backup = await exportAllData(database);

    const fresh = createTestDatabase();
    await migrate(fresh);
    await restoreAllData(fresh, backup);

    expect(await exportAllData(fresh)).toBe(backup);
    expect((await getProfile(fresh))?.name).toBe('Ислам');
  });

  it('replaces existing data', async () => {
    const { database } = await seedData();
    const backup = await exportAllData(database);
    await saveBodyWeight(database, '2026-11-05', 90, NOW);

    await restoreAllData(database, backup);

    expect(await listBodyWeight(database)).toHaveLength(1);
  });

  it.each([
    ['not json', 'not_a_backup'],
    ['{"format":"other"}', 'not_a_backup'],
    ['{"format":"ironvant-export","schemaVersion":1,"tables":{"profile":[]}}', 'damaged'],
    ['{"format":"ironvant-export","schemaVersion":9999,"tables":{}}', 'too_new'],
  ])('rejects %s', async (text, problem) => {
    const { database } = await seedData();

    await expect(restoreAllData(database, text)).rejects.toMatchObject({ problem });
    await expect(restoreAllData(database, text)).rejects.toBeInstanceOf(BackupError);
  });

  it('keeps current data when a backup fails half way', async () => {
    const { database } = await seedData();
    const parsed = JSON.parse(await exportAllData(database));
    parsed.tables.workout_set[0].session_exercise_id = 'missing';

    await expect(restoreAllData(database, JSON.stringify(parsed))).rejects.toThrow();

    expect((await getProfile(database))?.name).toBe('Ислам');
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
  });

  it('refuses unknown columns instead of building SQL from them', async () => {
    const { database } = await seedData();
    const parsed = JSON.parse(await exportAllData(database));
    parsed.tables.settings = [{ 'key) VALUES (1); DROP TABLE profile; --': 'x' }];

    await expect(restoreAllData(database, JSON.stringify(parsed))).rejects.toMatchObject({ problem: 'damaged' });

    expect((await getProfile(database))?.name).toBe('Ислам');
  });

  it('restores a backup from an older schema version', async () => {
    const { database } = await seedData();
    const parsed = JSON.parse(await exportAllData(database));
    parsed.schemaVersion = migrations.length - 1;
    for (const row of parsed.tables.workout_set) {
      delete row.kind;
      delete row.note;
    }
    delete parsed.tables.body_weight;

    await restoreAllData(database, JSON.stringify(parsed));

    const [set] = await database.all<{ kind: string }>('SELECT kind FROM workout_set');
    expect(set.kind).toBe('working');
    expect(await listBodyWeight(database)).toEqual([]);
  });
});
