import { migrate } from '@/domains/data-platform/migrations';
import { estimateMuscleLoad, listRecentWork } from '@/domains/progress/muscle-recovery';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

const NOW = new Date('2026-06-10T12:00:00.000Z');
const HOUR_MS = 60 * 60 * 1000;

let nextId = 0;
const createId = () => {
  nextId += 1;
  return `id-${nextId}`;
};

function hoursAgo(hours: number) {
  return new Date(NOW.getTime() - hours * HOUR_MS).toISOString();
}

describe('estimateMuscleLoad', () => {
  it('is empty without recent work', () => {
    expect(estimateMuscleLoad([], NOW)).toEqual({});
  });

  it('marks the main muscles fully right after enough sets', () => {
    const load = estimateMuscleLoad([{ exerciseId: 'bench-press', finishedAt: hoursAgo(0), sets: 4 }], NOW);

    expect(load.chest).toBe(1);
    expect(load.triceps).toBe(0.5);
    expect(load.quads).toBeUndefined();
  });

  it('counts fewer sets for less', () => {
    const load = estimateMuscleLoad([{ exerciseId: 'bench-press', finishedAt: hoursAgo(0), sets: 2 }], NOW);

    expect(load.chest).toBe(0.5);
  });

  it('never goes over one with many sets', () => {
    const load = estimateMuscleLoad([{ exerciseId: 'bench-press', finishedAt: hoursAgo(0), sets: 40 }], NOW);

    expect(load.chest).toBe(1);
  });

  it('fades over three days', () => {
    const exercise = { exerciseId: 'bench-press', sets: 4 };

    expect(estimateMuscleLoad([{ ...exercise, finishedAt: hoursAgo(36) }], NOW).chest).toBe(0.5);
    expect(estimateMuscleLoad([{ ...exercise, finishedAt: hoursAgo(72) }], NOW).chest).toBeUndefined();
  });

  it('keeps the strongest mark when work overlaps', () => {
    const load = estimateMuscleLoad(
      [
        { exerciseId: 'bench-press', finishedAt: hoursAgo(60), sets: 4 },
        { exerciseId: 'bench-press', finishedAt: hoursAgo(12), sets: 4 },
      ],
      NOW,
    );

    expect(load.chest).toBeCloseTo(60 / 72);
  });

  it('skips unknown exercises and dates ahead of the clock', () => {
    expect(
      estimateMuscleLoad(
        [
          { exerciseId: 'deleted-exercise', finishedAt: hoursAgo(1), sets: 4 },
          { exerciseId: 'bench-press', finishedAt: hoursAgo(-5), sets: 4 },
        ],
        NOW,
      ),
    ).toEqual({});
  });
});

describe('listRecentWork', () => {
  it('counts working sets of completed workouts in the window', async () => {
    const database = createTestDatabase();
    await migrate(database);
    const clock = { time: NOW.getTime() - 100 * HOUR_MS };
    const engine = new WorkoutEngine({ database, createId, now: () => new Date(clock.time) });

    const finish = async (sets: number, warmups = 0) => {
      const sessionId = await engine.startSession({
        operationId: createId(),
        title: 'Тренировка',
        programDayId: null,
        exercises: [{ exerciseId: 'bench-press', plannedSets: 3, repsMin: 8, repsMax: 12 }],
      });
      const session = await engine.getSession(sessionId);
      for (let index = 0; index < warmups; index += 1) {
        await engine.logSet(session!.exercises[0].id, { weightKg: 20, reps: 10, rir: null, kind: 'warmup' }, createId());
      }
      for (let index = 0; index < sets; index += 1) {
        await engine.logSet(session!.exercises[0].id, { weightKg: 60, reps: 10, rir: null }, createId());
      }
      await engine.completeSession(sessionId, createId());
    };

    await finish(5);
    clock.time = NOW.getTime() - 10 * HOUR_MS;
    await finish(3, 2);

    expect(await listRecentWork(database, NOW)).toEqual([
      { exerciseId: 'bench-press', finishedAt: new Date(clock.time).toISOString(), sets: 3 },
    ]);
  });
});
