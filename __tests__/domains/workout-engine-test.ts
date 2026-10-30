let nextId = 0;
const randomUUID = () => `id-${++nextId}`;

import type { Database } from '@/domains/data-platform/database';
import { migrate } from '@/domains/data-platform/migrations';
import { suggestNextWeight } from '@/domains/workout/progression';
import { formatDuration, sessionDurationMs } from '@/domains/workout/session-time';
import { type SessionCommand, type SessionState, nextState } from '@/domains/workout/state-machine';
import { WorkoutError, type WorkoutSet } from '@/domains/workout/types';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

const START = Date.parse('2026-11-01T10:00:00.000Z');
const MINUTE = 60_000;
const bench = { exerciseId: 'bench-press', plannedSets: 3, repsMin: 8, repsMax: 12 };
const set = { weightKg: 80, reps: 8, rir: 2 };

async function setup() {
  const database: Database = createTestDatabase();
  await migrate(database);
  const clock = { time: START };
  const engine = new WorkoutEngine({
    database,
    createId: () => randomUUID(),
    now: () => new Date(clock.time),
  });
  return { database, clock, engine };
}

async function start(engine: WorkoutEngine) {
  const sessionId = await engine.startSession({
    operationId: randomUUID(),
    title: 'Верх тела',
    programDayId: null,
    exercises: [bench],
  });
  const session = await engine.getSession(sessionId);
  return { sessionId, exerciseId: session!.exercises[0].id };
}

async function expectCode(action: Promise<unknown>, code: string) {
  await expect(action).rejects.toMatchObject({ name: 'WorkoutError', code });
  await expect(action).rejects.toBeInstanceOf(WorkoutError);
}

describe('state machine', () => {
  const allowed: [SessionState, SessionCommand, SessionState][] = [
    ['planned', 'start', 'active'],
    ['planned', 'cancel', 'cancelled'],
    ['active', 'pause', 'paused'],
    ['active', 'complete', 'completed'],
    ['active', 'cancel', 'cancelled'],
    ['paused', 'resume', 'active'],
    ['paused', 'complete', 'completed'],
    ['paused', 'cancel', 'cancelled'],
  ];
  const states: SessionState[] = ['planned', 'active', 'paused', 'completed', 'cancelled'];
  const commands: SessionCommand[] = ['start', 'pause', 'resume', 'complete', 'cancel'];

  it.each(allowed)('moves %s through %s to %s', (state, command, expected) => {
    expect(nextState(state, command)).toBe(expected);
  });

  it('rejects every other transition', () => {
    const pairs = states.flatMap((state) => commands.map((command) => [state, command] as const));
    const rejected = pairs.filter(
      ([state, command]) => !allowed.some(([from, via]) => from === state && via === command),
    );
    for (const [state, command] of rejected) {
      expect(nextState(state, command)).toBeNull();
    }
  });
});

describe('WorkoutEngine', () => {
  it('saves a set durably before returning', async () => {
    const { database, engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);

    await engine.logSet(exerciseId, set, randomUUID());

    const rows = await database.all('SELECT weight_kg, reps, rir, position FROM workout_set');
    expect(rows).toEqual([{ weight_kg: 80, reps: 8, rir: 2, position: 1 }]);
    const session = await engine.getSession(sessionId);
    expect(session?.exercises[0].sets).toHaveLength(1);
  });

  it('applies a repeated operation only once', async () => {
    const { engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);
    const operationId = randomUUID();

    const first = await engine.logSet(exerciseId, set, operationId);
    const repeat = await engine.logSet(exerciseId, set, operationId);

    expect(repeat).toBe(first);
    const session = await engine.getSession(sessionId);
    expect(session?.exercises[0].sets).toHaveLength(1);
  });

  it('keeps a repeated start from opening a second session', async () => {
    const { engine } = await setup();
    const input = { operationId: randomUUID(), title: 'А', programDayId: null, exercises: [] };

    const first = await engine.startSession(input);
    const repeat = await engine.startSession(input);

    expect(repeat).toBe(first);
  });

  it('allows only one open session', async () => {
    const { engine } = await setup();
    await start(engine);

    await expectCode(start(engine), 'session_already_open');
  });

  it('writes nothing when a command fails', async () => {
    const { database, engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);
    await engine.pauseSession(sessionId, randomUUID());
    const before = await database.all('SELECT * FROM workout_event');

    await expectCode(engine.logSet(exerciseId, set, randomUUID()), 'session_not_active');

    expect(await database.all('SELECT * FROM workout_event')).toEqual(before);
    expect(await database.all('SELECT * FROM workout_set')).toEqual([]);
  });

  it.each([
    [{ weightKg: -1, reps: 8, rir: null }],
    [{ weightKg: 2000, reps: 8, rir: null }],
    [{ weightKg: Number.NaN, reps: 8, rir: null }],
    [{ weightKg: 80, reps: 0, rir: null }],
    [{ weightKg: 80, reps: 1.5, rir: null }],
    [{ weightKg: 80, reps: 8, rir: 11 }],
  ])('rejects invalid set %j', async (input) => {
    const { engine } = await setup();
    const { exerciseId } = await start(engine);

    await expectCode(engine.logSet(exerciseId, input, randomUUID()), 'invalid_set');
  });

  it('accepts a bodyweight set without weight', async () => {
    const { engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);

    await engine.logSet(exerciseId, { weightKg: null, reps: 12, rir: null }, randomUUID());

    const session = await engine.getSession(sessionId);
    expect(session?.exercises[0].sets[0].weightKg).toBeNull();
  });

  it('edits a set and keeps its history in the event log', async () => {
    const { database, engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);
    const setId = await engine.logSet(exerciseId, set, randomUUID());

    await engine.updateSet(setId, { weightKg: 82.5, reps: 7, rir: 1 }, randomUUID());

    const session = await engine.getSession(sessionId);
    expect(session?.exercises[0].sets[0]).toMatchObject({ weightKg: 82.5, reps: 7, rir: 1 });
    const event = await database.first<{ payload: string }>(
      "SELECT payload FROM workout_event WHERE type = 'set_updated'",
    );
    expect(JSON.parse(event!.payload).before.weightKg).toBe(80);
  });

  it('deletes a set and closes the numbering gap', async () => {
    const { engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);
    const first = await engine.logSet(exerciseId, set, randomUUID());
    await engine.logSet(exerciseId, { ...set, reps: 7 }, randomUUID());

    await engine.deleteSet(first, randomUUID());
    const next = await engine.logSet(exerciseId, { ...set, reps: 6 }, randomUUID());

    const session = await engine.getSession(sessionId);
    expect(session?.exercises[0].sets.map(({ position, reps }) => [position, reps])).toEqual([
      [1, 7],
      [2, 6],
    ]);
    expect(next).toBeTruthy();
  });

  it('excludes pauses from the duration', async () => {
    const { clock, engine } = await setup();
    const { sessionId } = await start(engine);

    clock.time += 10 * MINUTE;
    await engine.pauseSession(sessionId, randomUUID());
    clock.time += 30 * MINUTE;
    await engine.resumeSession(sessionId, randomUUID());
    clock.time += 5 * MINUTE;
    await engine.completeSession(sessionId, randomUUID());

    const session = await engine.getSession(sessionId);
    expect(session?.state).toBe('completed');
    expect(sessionDurationMs(session!, new Date(clock.time))).toBe(15 * MINUTE);
  });

  it('completes a paused session without counting the pause', async () => {
    const { clock, engine } = await setup();
    const { sessionId } = await start(engine);

    clock.time += 10 * MINUTE;
    await engine.pauseSession(sessionId, randomUUID());
    clock.time += 30 * MINUTE;
    await engine.completeSession(sessionId, randomUUID());

    const session = await engine.getSession(sessionId);
    expect(sessionDurationMs(session!, new Date(clock.time))).toBe(10 * MINUTE);
  });

  it('rejects changes to a completed session', async () => {
    const { engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);
    const setId = await engine.logSet(exerciseId, set, randomUUID());
    await engine.completeSession(sessionId, randomUUID());

    await expectCode(engine.logSet(exerciseId, set, randomUUID()), 'session_not_active');
    await expectCode(engine.updateSet(setId, set, randomUUID()), 'session_not_active');
    await expectCode(engine.deleteSet(setId, randomUUID()), 'session_not_active');
    await expectCode(engine.pauseSession(sessionId, randomUUID()), 'invalid_transition');
  });

  it('adds an exercise that was not in the plan', async () => {
    const { engine } = await setup();
    const { sessionId } = await start(engine);

    await engine.addExercise(sessionId, 'plank', randomUUID());

    const session = await engine.getSession(sessionId);
    expect(session?.exercises.map(({ exerciseId, position }) => [exerciseId, position])).toEqual([
      ['bench-press', 1],
      ['plank', 2],
    ]);
  });

  describe('crash recovery', () => {
    it('restores the session and its sets after a restart', async () => {
      const { clock, database, engine } = await setup();
      const { sessionId, exerciseId } = await start(engine);
      clock.time += 20 * MINUTE;
      await engine.logSet(exerciseId, set, randomUUID());

      clock.time += 3 * 60 * MINUTE;
      const restarted = new WorkoutEngine({
        database,
        createId: () => randomUUID(),
        now: () => new Date(clock.time),
      });

      expect(await restarted.recoverInterruptedSession()).toBe(sessionId);
      const session = await restarted.getOpenSession();
      expect(session?.state).toBe('paused');
      expect(session?.exercises[0].sets).toHaveLength(1);
    });

    it('does not count the time after the last activity', async () => {
      const { clock, engine } = await setup();
      const { sessionId, exerciseId } = await start(engine);
      clock.time += 20 * MINUTE;
      await engine.logSet(exerciseId, set, randomUUID());
      clock.time += 3 * 60 * MINUTE;

      await engine.recoverInterruptedSession();
      clock.time += MINUTE;
      await engine.resumeSession(sessionId, randomUUID());
      clock.time += 10 * MINUTE;
      await engine.completeSession(sessionId, randomUUID());

      const session = await engine.getSession(sessionId);
      expect(sessionDurationMs(session!, new Date(clock.time))).toBe(30 * MINUTE);
    });

    it('dates a session finished days later by when it was interrupted', async () => {
      const { clock, engine } = await setup();
      const { sessionId, exerciseId } = await start(engine);
      clock.time += 20 * MINUTE;
      await engine.logSet(exerciseId, set, randomUUID());
      const interruptedAt = clock.time;
      clock.time += 4 * 24 * 60 * MINUTE;

      await engine.recoverInterruptedSession();
      await engine.completeSession(sessionId, randomUUID());

      const session = await engine.getSession(sessionId);
      expect(Date.parse(session!.finishedAt!)).toBe(interruptedAt);
      expect(sessionDurationMs(session!, new Date(clock.time))).toBe(20 * MINUTE);
    });

    it('pauses an idle session only after the allowed time', async () => {
      const { clock, engine } = await setup();
      const { sessionId } = await start(engine);
      const allowedIdle = 180 * MINUTE;

      clock.time += 60 * MINUTE;
      expect(await engine.recoverInterruptedSession(allowedIdle)).toBeNull();

      clock.time += 180 * MINUTE;
      expect(await engine.recoverInterruptedSession(allowedIdle)).toBe(sessionId);
    });

    it('leaves a paused session alone', async () => {
      const { engine } = await setup();
      const { sessionId } = await start(engine);
      await engine.pauseSession(sessionId, randomUUID());

      expect(await engine.recoverInterruptedSession()).toBeNull();
    });
  });

  it('removes an empty exercise and closes the numbering gap', async () => {
    const { engine } = await setup();
    const { sessionId, exerciseId } = await start(engine);
    await engine.addExercise(sessionId, 'plank', randomUUID());

    await engine.removeExercise(exerciseId, randomUUID());

    const session = await engine.getSession(sessionId);
    expect(session?.exercises.map(({ exerciseId: id, position }) => [id, position])).toEqual([['plank', 1]]);
  });

  it('refuses to remove an exercise with recorded sets', async () => {
    const { engine } = await setup();
    const { exerciseId } = await start(engine);
    await engine.logSet(exerciseId, set, randomUUID());

    await expectCode(engine.removeExercise(exerciseId, randomUUID()), 'exercise_has_sets');
  });

  it('remembers reported discomfort for two weeks', async () => {
    const { clock, engine } = await setup();
    const { exerciseId } = await start(engine);

    expect(await engine.hasRecentDiscomfort('bench-press')).toBe(false);
    await engine.reportDiscomfort(exerciseId, randomUUID());
    expect(await engine.hasRecentDiscomfort('bench-press')).toBe(true);

    clock.time += 15 * 24 * 60 * MINUTE;
    expect(await engine.hasRecentDiscomfort('bench-press')).toBe(false);
  });

  describe('last performance', () => {
    it('returns the sets of the most recent completed session', async () => {
      const { clock, engine } = await setup();
      for (const weightKg of [70, 75]) {
        const { sessionId, exerciseId } = await start(engine);
        await engine.logSet(exerciseId, { ...set, weightKg }, randomUUID());
        await engine.completeSession(sessionId, randomUUID());
        clock.time += 24 * 60 * MINUTE;
      }

      const sets = await engine.getLastPerformance('bench-press');

      expect(sets.map(({ weightKg }) => weightKg)).toEqual([75]);
    });

    it('ignores cancelled sessions', async () => {
      const { engine } = await setup();
      const { sessionId, exerciseId } = await start(engine);
      await engine.logSet(exerciseId, set, randomUUID());
      await engine.cancelSession(sessionId, randomUUID());

      expect(await engine.getLastPerformance('bench-press')).toEqual([]);
    });
  });
});

describe('suggestNextWeight', () => {
  const makeSet = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
    id: 'set',
    position: 1,
    weightKg: 80,
    reps: 12,
    rir: 2,
    completedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  });

  it('suggests a step up when every planned set reached the top of the range', () => {
    expect(suggestNextWeight([makeSet({}), makeSet({})], 12, 2)).toBe(82.5);
    expect(suggestNextWeight([makeSet({ rir: 1 })], 12, 1)).toBe(82.5);
  });

  it('uses a smaller step for light weights', () => {
    expect(suggestNextWeight([makeSet({ weightKg: 4 })], 12, 1)).toBe(5);
  });

  it('stays quiet when a set fell short', () => {
    expect(suggestNextWeight([makeSet({}), makeSet({ reps: 10 })], 12, 2)).toBeNull();
  });

  it('stays quiet when fewer sets than planned were done', () => {
    expect(suggestNextWeight([makeSet({})], 12, 3)).toBeNull();
  });

  it('stays quiet when a set was at failure or the reserve is unknown', () => {
    expect(suggestNextWeight([makeSet({ rir: 0 })], 12, 1)).toBeNull();
    expect(suggestNextWeight([makeSet({ rir: null })], 12, 1)).toBeNull();
  });

  it('stays quiet after sets with different weights', () => {
    expect(suggestNextWeight([makeSet({}), makeSet({ weightKg: 75 })], 12, 2)).toBeNull();
  });

  it('stays quiet without a target or without history', () => {
    expect(suggestNextWeight([makeSet({})], null, null)).toBeNull();
    expect(suggestNextWeight([], 12, 3)).toBeNull();
  });

  it('stays quiet for bodyweight sets', () => {
    expect(suggestNextWeight([makeSet({ weightKg: null })], 12, 1)).toBeNull();
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0:00'],
    [65_000, '1:05'],
    [3_725_000, '1:02:05'],
  ])('formats %d ms as %s', (durationMs, expected) => {
    expect(formatDuration(durationMs)).toBe(expected);
  });
});
