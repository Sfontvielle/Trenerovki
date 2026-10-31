let nextId = 0;
const randomUUID = () => `id-${++nextId}`;

import type { Database } from '@/domains/data-platform/database';
import { migrate } from '@/domains/data-platform/migrations';
import { suggestNextSet, suggestRestSeconds } from '@/domains/workout/progression';
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

  it('remembers discomfort even after the exercise is removed from the workout', async () => {
    const { engine } = await setup();
    const { exerciseId } = await start(engine);

    await engine.reportDiscomfort(exerciseId, randomUUID());
    await engine.removeExercise(exerciseId, randomUUID());

    expect(await engine.hasRecentDiscomfort('bench-press')).toBe(true);
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

describe('suggestNextSet', () => {
  const makeSet = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
    id: 'set',
    position: 1,
    weightKg: 80,
    reps: 12,
    rir: 2,
    kind: 'working',
    note: null,
    durationSec: null,
    distanceM: null,
    completedAt: '2026-11-01T10:00:00.000Z',
    ...overrides,
  });
  const target = { repsMin: 8, repsMax: 12, plannedSets: 2 };

  it('adds weight when every planned set reached the top of the range with reserve', () => {
    expect(suggestNextSet([[makeSet({}), makeSet({})]], target)).toMatchObject({
      kind: 'add_weight',
      weightKg: 82.5,
      reps: 8,
    });
  });

  it('uses a smaller step for light weights', () => {
    expect(suggestNextSet([[makeSet({ weightKg: 4 })]], { ...target, plannedSets: 1 })?.weightKg).toBe(5);
  });

  it('ignores warm-up sets', () => {
    const warmup = makeSet({ weightKg: 40, reps: 5, rir: null, kind: 'warmup' });

    expect(suggestNextSet([[warmup, makeSet({}), makeSet({})]], target)?.kind).toBe('add_weight');
  });

  it('adds a rep inside the range before adding weight', () => {
    expect(suggestNextSet([[makeSet({ reps: 10 }), makeSet({ reps: 9 })]], target)).toMatchObject({
      kind: 'add_rep',
      weightKg: 80,
      reps: 10,
    });
  });

  it('holds the weight without reserve or when weights differ', () => {
    expect(suggestNextSet([[makeSet({ rir: 0 }), makeSet({ rir: 0 })]], target)?.kind).toBe('hold');
    expect(suggestNextSet([[makeSet({ rir: null }), makeSet({})]], target)?.kind).toBe('hold');
    expect(suggestNextSet([[makeSet({}), makeSet({ weightKg: 75 })]], target)?.kind).toBe('hold');
  });

  it('holds after one bad workout and reduces after two', () => {
    const short = [makeSet({ reps: 6 }), makeSet({ reps: 5 })];

    expect(suggestNextSet([short], target)?.kind).toBe('hold');
    expect(suggestNextSet([short, short], target)).toMatchObject({ kind: 'reduce_weight', weightKg: 72, reps: 8 });
  });

  it('stays quiet without a complete last workout or a plan', () => {
    expect(suggestNextSet([[makeSet({})]], { ...target, plannedSets: 3 })).toBeNull();
    expect(suggestNextSet([[makeSet({})]], { repsMin: null, repsMax: null, plannedSets: null })).toBeNull();
    expect(suggestNextSet([], target)).toBeNull();
  });

  it('never suggests the same or a zero weight as a reduction', () => {
    const short = [makeSet({ weightKg: 5, reps: 4 }), makeSet({ weightKg: 5, reps: 4 })];
    const tiny = [makeSet({ weightKg: 1, reps: 4 }), makeSet({ weightKg: 1, reps: 4 })];

    expect(suggestNextSet([short, short], target)).toMatchObject({ kind: 'reduce_weight', weightKg: 4 });
    expect(suggestNextSet([tiny, tiny], target)?.kind).toBe('hold');
  });

  it('adds time only after the planned time was reached', () => {
    const held = [makeSet({ weightKg: null, reps: null, durationSec: 10 })];
    const options = { ...target, plannedSets: 1, targetDurationSec: 30 };

    expect(suggestNextSet([held], options)).toBeNull();
    expect(
      suggestNextSet([[makeSet({ weightKg: null, reps: null, durationSec: 30 })]], options),
    ).toMatchObject({ durationSec: 35 });
  });

  it('adds reps to bodyweight work and time to timed work', () => {
    expect(suggestNextSet([[makeSet({ weightKg: null })]], { ...target, plannedSets: 1 })).toMatchObject({
      kind: 'add_rep',
      reps: 13,
    });
    expect(
      suggestNextSet([[makeSet({ weightKg: null, reps: null, durationSec: 40 })]], { ...target, plannedSets: 1 }),
    ).toMatchObject({ kind: 'add_time', durationSec: 45 });
  });
});

describe('suggestRestSeconds', () => {
  it('rests longer after heavy compound work than after isolation or timed work', () => {
    expect(suggestRestSeconds({ isolation: false, timed: false, heavy: true })).toBe(180);
    expect(suggestRestSeconds({ isolation: false, timed: false, heavy: false })).toBe(120);
    expect(suggestRestSeconds({ isolation: true, timed: false, heavy: false })).toBe(75);
    expect(suggestRestSeconds({ isolation: false, timed: true, heavy: false })).toBe(45);
  });
});

describe('timed sets, groups, recovery and corrections', () => {
  async function startTwo(engine: WorkoutEngine) {
    const sessionId = await engine.startSession({
      operationId: randomUUID(),
      title: 'Тест',
      programDayId: null,
      exercises: [
        { exerciseId: 'bench-press', plannedSets: 3, repsMin: 8, repsMax: 12 },
        { exerciseId: 'dumbbell-row', plannedSets: 3, repsMin: 8, repsMax: 12 },
        { exerciseId: 'running', plannedSets: 1, repsMin: null, repsMax: null, targetDurationSec: 600 },
      ],
    });
    const session = await engine.getSession(sessionId);
    return { sessionId, exercises: session!.exercises };
  }

  it('records time and distance without reps', async () => {
    const { engine } = await setup();
    const { exercises } = await startTwo(engine);

    await engine.logSet(
      exercises[2].id,
      { weightKg: null, reps: null, rir: null, durationSec: 600, distanceM: 1500 },
      randomUUID(),
    );

    const session = await engine.getOpenSession();
    expect(session?.exercises[2].sets[0]).toMatchObject({ reps: null, durationSec: 600, distanceM: 1500 });
    expect(session?.exercises[2].targetDurationSec).toBe(600);
  });

  it('refuses a set with nothing measured', async () => {
    const { engine } = await setup();
    const { exercises } = await startTwo(engine);

    await expectCode(
      engine.logSet(exercises[0].id, { weightKg: 50, reps: null, rir: null }, randomUUID()),
      'invalid_set',
    );
  });

  it('links neighbours into one group and dissolves a group of one', async () => {
    const { engine } = await setup();
    const { exercises } = await startTwo(engine);

    await engine.linkWithNext(exercises[0].id, randomUUID());
    await engine.linkWithNext(exercises[1].id, randomUUID());
    let session = await engine.getOpenSession();
    const groupId = session?.exercises[0].groupId;
    expect(groupId).toBeTruthy();
    expect(session?.exercises.map((exercise) => exercise.groupId)).toEqual([groupId, groupId, groupId]);

    await engine.unlinkExercise(exercises[2].id, randomUUID());
    await engine.unlinkExercise(exercises[1].id, randomUUID());
    session = await engine.getOpenSession();
    expect(session?.exercises.map((exercise) => exercise.groupId)).toEqual([null, null, null]);
  });

  it('refuses to link the last exercise', async () => {
    const { engine } = await setup();
    const { exercises } = await startTwo(engine);

    await expectCode(engine.linkWithNext(exercises[2].id, randomUUID()), 'no_next_exercise');
  });

  it('marks an interrupted session until the user decides', async () => {
    const { engine } = await setup();
    const { sessionId } = await startTwo(engine);

    await engine.recoverInterruptedSession();
    expect((await engine.getSession(sessionId))?.recoveryRequired).toBe(true);

    await engine.resumeSession(sessionId, randomUUID());
    expect((await engine.getSession(sessionId))?.recoveryRequired).toBe(false);
  });

  async function finished(engine: WorkoutEngine) {
    const { sessionId, exercises } = await startTwo(engine);
    await engine.logSet(exercises[0].id, { weightKg: 50, reps: 8, rir: 2 }, randomUUID());
    await engine.logSet(exercises[0].id, { weightKg: 50, reps: 7, rir: 1 }, randomUUID());
    await engine.completeSession(sessionId, randomUUID());
    return (await engine.getSession(sessionId))!;
  }

  it('corrects a finished workout and keeps what it said before', async () => {
    const { database, engine } = await setup();
    const session = await finished(engine);
    const [first] = session.exercises[0].sets;

    await engine.correctCompletedSet(first.id, { weightKg: 55, reps: 8, rir: 2 }, randomUUID());

    expect((await engine.getSession(session.id))?.exercises[0].sets[0].weightKg).toBe(55);
    const event = await database.first<{ payload: string }>(
      "SELECT payload FROM workout_event WHERE type = 'completed_set_corrected'",
    );
    expect(JSON.parse(event!.payload).before.weightKg).toBe(50);
  });

  it('deletes finished sets but keeps at least one', async () => {
    const { engine } = await setup();
    const session = await finished(engine);
    const [first, second] = session.exercises[0].sets;

    await engine.deleteCompletedSet(first.id, randomUUID());
    expect((await engine.getSession(session.id))?.exercises[0].sets).toMatchObject([{ id: second.id, position: 1 }]);

    await expectCode(engine.deleteCompletedSet(second.id, randomUUID()), 'last_set');
  });

  it('does not correct sets of a workout still in progress', async () => {
    const { engine } = await setup();
    const { exercises } = await startTwo(engine);
    await engine.logSet(exercises[0].id, { weightKg: 50, reps: 8, rir: 2 }, randomUUID());
    const session = await engine.getOpenSession();

    await expectCode(
      engine.correctCompletedSet(session!.exercises[0].sets[0].id, { weightKg: 55, reps: 8, rir: 2 }, randomUUID()),
      'session_not_completed',
    );
  });
});
