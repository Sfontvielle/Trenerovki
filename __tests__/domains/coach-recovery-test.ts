import { readCoachFacts } from '@/domains/coach/coach-facts';
import {
  CoachError,
  acceptProposal,
  addMemory,
  deferProposal,
  deleteMemory,
  getDeloadUntil,
  isDeloadActive,
  listAvoidedExercises,
  listDecidedProposals,
  listFrequentlyRemoved,
  listMemory,
  listOpenProposals,
  listPlanVersions,
  rejectProposal,
  restorePlanVersion,
  syncProposals,
  undoProposal,
  updateMemory,
} from '@/domains/coach/coach-repository';
import { type CoachFacts, buildProposals, passesGuardrails } from '@/domains/coach/proposals';
import type { Database } from '@/domains/data-platform/database';
import { exportAllData, restoreAllData } from '@/domains/data-platform/data-transfer';
import { migrate } from '@/domains/data-platform/migrations';
import { generatePlan } from '@/domains/program/generate-plan';
import { getProgram } from '@/domains/program/program-repository';
import { completeOnboarding } from '@/domains/profile/complete-onboarding';
import type { Profile } from '@/domains/profile/profile';
import { getProfile } from '@/domains/profile/profile-repository';
import { type Checkin, assessReadiness, isValidSleep } from '@/domains/recovery/recovery';
import {
  countRecentWorkouts,
  getCheckin,
  listCheckins,
  listSteps,
  saveCheckin,
  saveSteps,
} from '@/domains/recovery/recovery-repository';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
let nextId = 0;
const randomUUID = () => `id-${++nextId}`;
const createId = () => randomUUID();

const profile: Profile = {
  name: 'Тест',
  sex: null,
  age: 30,
  weightKg: 80,
  goal: 'muscle',
  experience: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 45,
  equipment: 'gym',
  limitations: [],
  trainingDays: [],
  heightCm: null,
  activityLevel: null,
  usualSleepHours: null,
  baseline: null,
  nutritionMode: 'targets',
  diet: 'any',
};

async function setup(changes: Partial<Profile> = {}) {
  const database: Database = createTestDatabase();
  await migrate(database);
  const current = { ...profile, ...changes };
  await completeOnboarding(database, current, generatePlan(current), createId, NOW);
  return { database, profile: current };
}

function checkin(changes: Partial<Checkin>): Checkin {
  return {
    day: '2026-11-16',
    sleepHours: 8,
    sleepQuality: null,
    energy: 4,
    soreness: 1,
    stress: null,
    note: null,
    ...changes,
  };
}

describe('assessReadiness', () => {
  it('stays silent without sleep and at least one feeling', () => {
    expect(assessReadiness(null, 0)).toBeNull();
    expect(assessReadiness(checkin({ sleepHours: null }), 0)).toBeNull();
    expect(assessReadiness(checkin({ energy: null, soreness: null }), 0)).toBeNull();
  });

  it('grades a rested, a tired and an exhausted day', () => {
    expect(assessReadiness(checkin({}), 0)?.level).toBe('high');
    expect(assessReadiness(checkin({ sleepHours: 6.5, energy: 3, soreness: 2 }), 0)?.level).toBe('medium');
    expect(assessReadiness(checkin({ sleepHours: 5, energy: 2, soreness: 4 }), 2)?.level).toBe('low');
  });

  it('names its reasons and sources', () => {
    const result = assessReadiness(checkin({ sleepHours: 5, stress: 5 }), 0);

    expect(result?.reasons).toEqual(['мало сна', 'высокий стресс']);
    expect(result?.sources).toEqual(['сон', 'энергия', 'мышечная боль', 'стресс', 'история тренировок']);
  });

  it('validates sleep hours', () => {
    expect(isValidSleep(null)).toBe(true);
    expect(isValidSleep(7.5)).toBe(true);
    expect(isValidSleep(20)).toBe(false);
    expect(isValidSleep(Number.NaN)).toBe(false);
  });
});

describe('recovery records', () => {
  it('overwrites the check-in of the same day and lists days in order', async () => {
    const { database } = await setup();

    await saveCheckin(database, checkin({ day: '2026-11-15' }), NOW);
    await saveCheckin(database, checkin({ day: '2026-11-16', sleepHours: 6 }), NOW);
    await saveCheckin(database, checkin({ day: '2026-11-16', sleepHours: 7 }), NOW);

    expect((await getCheckin(database, '2026-11-16'))?.sleepHours).toBe(7);
    expect((await listCheckins(database, 7)).map(({ day }) => day)).toEqual(['2026-11-15', '2026-11-16']);
  });

  it('keeps one step count per day', async () => {
    const { database } = await setup();

    await saveSteps(database, '2026-11-16', 100, NOW);
    await saveSteps(database, '2026-11-16', 250, NOW);

    expect(await listSteps(database, 7)).toEqual([{ day: '2026-11-16', steps: 250 }]);
  });

  it('counts workouts of the last two days', async () => {
    const { database } = await setup();

    expect(await countRecentWorkouts(database, NOW)).toBe(0);
  });
});

function facts(context: Awaited<ReturnType<typeof setup>>, program: CoachFacts['program'], changes: Partial<CoachFacts> = {}): CoachFacts {
  return {
    today: '2026-11-16',
    program,
    profile: context.profile,
    discomfort: [],
    plateaus: [],
    avoided: [],
    workoutsByWeek: [3, 3, 3, 3, 0, 0],
    weeksOfHistory: 6,
    lowReadinessDays: 0,
    weeklySetsByGroup: {},
    deloadUntil: null,
    ...changes,
  };
}

describe('buildProposals', () => {
  it('offers a replacement for an exercise that caused discomfort', async () => {
    const context = await setup();
    const program = await getProgram(context.database);
    const exerciseId = program[0].exercises[0].exerciseId;

    const [draft] = buildProposals(facts(context, program, { discomfort: [exerciseId] }));

    expect(draft.kind).toBe('discomfort');
    expect(draft.why).toContain('обратитесь к врачу');
    expect(draft.change).toMatchObject({ type: 'replace', fromExerciseId: exerciseId });
  });

  it('never replaces with something avoided, painful or loading a limited zone', async () => {
    const context = await setup();
    const program = await getProgram(context.database);
    const entry = program[0].exercises[0];
    const [first] = buildProposals(facts(context, program, { discomfort: [entry.exerciseId] }));
    const proposed = first.change.type === 'replace' ? first.change.toExerciseId : '';

    const drafts = buildProposals(facts(context, program, { discomfort: [entry.exerciseId], avoided: [proposed] }));

    expect(drafts[0].change).not.toMatchObject({ toExerciseId: proposed });
  });

  it('flags a planned exercise that loads a limited zone', async () => {
    const context = await setup();
    const program = await getProgram(context.database);
    const limited = { ...context, profile: { ...context.profile, limitations: ['knees' as const] } };

    const drafts = buildProposals(facts(limited, program));

    expect(drafts.some(({ kind }) => kind === 'limited_zone')).toBe(true);
  });

  it('suggests a lighter week after steady training or low readiness, once', async () => {
    const context = await setup();
    const program = await getProgram(context.database);

    const steady = buildProposals(facts(context, program, { workoutsByWeek: [3, 3, 3, 3, 3, 0] }));
    const tired = buildProposals(facts(context, program, { lowReadinessDays: 3 }));
    const active = buildProposals(facts(context, program, { lowReadinessDays: 3, deloadUntil: '2026-11-20' }));

    expect(steady.map(({ kind }) => kind)).toContain('deload');
    expect(tired.map(({ kind }) => kind)).toContain('deload');
    expect(active.map(({ kind }) => kind)).not.toContain('deload');
  });

  it('proposes fewer days after three thin weeks', async () => {
    const context = await setup({ daysPerWeek: 4 });
    const program = await getProgram(context.database);

    const drafts = buildProposals(facts(context, program, { workoutsByWeek: [1, 2, 1, 0, 0, 0] }));

    expect(drafts.find(({ kind }) => kind === 'fewer_days')?.change).toEqual({ type: 'days', from: 4, to: 3 });
  });

  it('does not read a pattern into the first weeks of a newcomer', async () => {
    const context = await setup();
    const program = await getProgram(context.database);

    const drafts = buildProposals(facts(context, program, { workoutsByWeek: [1, 0, 0, 0, 0, 0], weeksOfHistory: 0 }));

    expect(drafts.map(({ kind }) => kind)).not.toContain('fewer_days');
  });

  it('counts whole weeks since the first finished workout', async () => {
    const context = await setup();
    const engine = new WorkoutEngine({ database: context.database, createId, now: () => NOW });
    const sessionId = await engine.startSession({
      operationId: randomUUID(),
      title: 'Т',
      programDayId: null,
      exercises: [{ exerciseId: 'push-up', plannedSets: 1, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    await engine.logSet(session!.exercises[0].id, { weightKg: null, reps: 10, rir: 2 }, randomUUID());
    await engine.completeSession(sessionId, randomUUID());

    const later = new Date(NOW.getTime() + 3 * WEEK_MS + 1);

    expect((await readCoachFacts(context.database, context.profile, NOW)).weeksOfHistory).toBe(0);
    expect((await readCoachFacts(context.database, context.profile, later)).weeksOfHistory).toBe(3);
  });

  it('adds a set for an undertrained group but not during a lighter week', async () => {
    const context = await setup();
    const program = await getProgram(context.database);
    const weeklySetsByGroup = { legs: 3 };

    expect(buildProposals(facts(context, program, { weeklySetsByGroup })).map(({ kind }) => kind)).toContain('low_volume');
    expect(
      buildProposals(facts(context, program, { weeklySetsByGroup, deloadUntil: '2026-11-20' })).map(({ kind }) => kind),
    ).not.toContain('low_volume');
  });

  it('rejects stale changes in the guardrails', async () => {
    const context = await setup();
    const program = await getProgram(context.database);
    const entry = program[0].exercises[0];
    const base = facts(context, program);

    expect(
      passesGuardrails(
        {
          change: {
            type: 'replace',
            programExerciseId: 'gone',
            fromExerciseId: entry.exerciseId,
            toExerciseId: 'bench-press',
            target: { repsMin: 8, repsMax: 12, targetDurationSec: null },
          },
        },
        base,
      ),
    ).toBe(false);
    expect(
      passesGuardrails({ change: { type: 'sets', programExerciseId: entry.id, exerciseId: entry.exerciseId, from: 9, to: 10 } }, base),
    ).toBe(false);
    expect(passesGuardrails({ change: { type: 'days', from: 5, to: 4 } }, base)).toBe(false);
  });
});

describe('decisions', () => {
  async function proposal(context: Awaited<ReturnType<typeof setup>>, changes: Partial<CoachFacts> = {}) {
    const program = await getProgram(context.database);
    const current = facts(context, program, changes);
    await syncProposals(context.database, buildProposals(current), NOW, createId);
    return { current, open: await listOpenProposals(context.database) };
  }

  async function painful(context: Awaited<ReturnType<typeof setup>>) {
    const [day] = await getProgram(context.database);
    return proposal(context, { discomfort: [day.exercises[0].exerciseId] });
  }

  it('applies an accepted replacement, keeps the old plan and can undo it', async () => {
    const context = await setup();
    const before = await getProgram(context.database);
    const { current, open } = await painful(context);

    await acceptProposal(context.database, open[0].id, { facts: current, now: NOW, createId });

    const changed = await getProgram(context.database);
    expect(changed[0].exercises[0].exerciseId).not.toBe(before[0].exercises[0].exerciseId);
    expect(await listPlanVersions(context.database)).toHaveLength(1);

    await undoProposal(context.database, open[0].id, NOW);

    expect(await getProgram(context.database)).toEqual(before);
    expect((await listDecidedProposals(context.database))[0].status).toBe('undone');
  });

  it('lets the user pick another replacement', async () => {
    const context = await setup();
    const { current, open } = await painful(context);
    const change = open[0].change;
    if (change.type !== 'replace') {
      throw new Error('expected a replacement');
    }

    await acceptProposal(context.database, open[0].id, {
      facts: current,
      now: NOW,
      createId,
      change: { ...change, toExerciseId: 'leg-curl' },
    });

    expect((await getProgram(context.database))[0].exercises[0].exerciseId).toBe('leg-curl');
  });

  it('refuses a proposal the plan has moved past', async () => {
    const context = await setup();
    const { current, open } = await painful(context);
    await context.database.run('UPDATE program_exercise SET exercise_id = ? WHERE id = ?', [
      'crunch',
      current.program[0].exercises[0].id,
    ]);
    const fresh = { ...current, program: await getProgram(context.database) };

    await expect(
      acceptProposal(context.database, open[0].id, { facts: fresh, now: NOW, createId }),
    ).rejects.toBeInstanceOf(CoachError);

    expect(await listPlanVersions(context.database)).toEqual([]);
  });

  it('starts and cancels a lighter week', async () => {
    const context = await setup();
    const { current, open } = await proposal(context, { lowReadinessDays: 3 });
    const deload = open.find(({ kind }) => kind === 'deload');

    await acceptProposal(context.database, deload!.id, { facts: current, now: NOW, createId });

    const until = await getDeloadUntil(context.database);
    expect(until).toBe('2026-11-23');
    expect(isDeloadActive(until, '2026-11-20')).toBe(true);
    expect(isDeloadActive(until, '2026-11-24')).toBe(false);

    await undoProposal(context.database, deload!.id, NOW);

    expect(await getDeloadUntil(context.database)).toBeNull();
  });

  it('rebuilds a plan for fewer days and restores it on undo', async () => {
    const context = await setup({ daysPerWeek: 4 });
    const { current, open } = await proposal(context, { workoutsByWeek: [1, 2, 1, 0, 0, 0] });
    const fewer = open.find(({ kind }) => kind === 'fewer_days');

    await acceptProposal(context.database, fewer!.id, { facts: current, now: NOW, createId });

    expect(await getProgram(context.database)).toHaveLength(3);
    expect((await getProfile(context.database))?.daysPerWeek).toBe(3);

    await undoProposal(context.database, fewer!.id, NOW);

    expect(await getProgram(context.database)).toHaveLength(4);
    expect((await getProfile(context.database))?.daysPerWeek).toBe(4);
  });

  it('stays quiet after a rejection and returns after a deferral', async () => {
    const context = await setup();
    const { current, open } = await painful(context);

    await rejectProposal(context.database, open[0].id, NOW);
    await syncProposals(context.database, buildProposals(current), NOW, createId);
    expect(await listOpenProposals(context.database)).toEqual([]);

    const later = new Date(NOW.getTime() + 5 * WEEK_MS);
    await syncProposals(context.database, buildProposals(current), later, createId);
    const [returned] = await listOpenProposals(context.database);
    expect(returned.fingerprint).toBe(open[0].fingerprint);

    await deferProposal(context.database, returned.id, later);
    await syncProposals(context.database, buildProposals(current), later, createId);
    expect(await listOpenProposals(context.database)).toEqual([]);

    const afterDefer = new Date(later.getTime() + WEEK_MS + 1);
    await syncProposals(context.database, buildProposals(current), afterDefer, createId);
    expect(await listOpenProposals(context.database)).toHaveLength(1);
  });

  it('drops open proposals the facts no longer support', async () => {
    const context = await setup();
    await painful(context);

    await syncProposals(context.database, [], NOW, createId);

    expect(await listOpenProposals(context.database)).toEqual([]);
  });
});

describe('plan versions', () => {
  it('saves the old plan when answers replace it, and returns to it', async () => {
    const context = await setup();
    const before = await getProgram(context.database);
    const changed = { ...context.profile, goal: 'strength' as const };

    await completeOnboarding(context.database, changed, generatePlan(changed), createId, NOW);

    const [version] = await listPlanVersions(context.database);
    expect(version.reason).toContain('изменённым ответам');

    await restorePlanVersion(context.database, version.id, createId, NOW);

    expect(await getProgram(context.database)).toEqual(before);
    expect(await listPlanVersions(context.database)).toHaveLength(2);
  });

  it('does not snapshot an empty plan on first onboarding', async () => {
    const { database } = await setup();

    expect(await listPlanVersions(database)).toEqual([]);
  });
});

describe('coach memory', () => {
  it('adds, edits and deletes confirmed entries', async () => {
    const { database } = await setup();

    await addMemory(database, { id: 'm1', kind: 'fact', text: ' Тренируюсь утром ', exerciseId: null }, NOW);
    await updateMemory(database, 'm1', 'Тренируюсь вечером', NOW);
    expect((await listMemory(database))[0]).toMatchObject({ text: 'Тренируюсь вечером' });

    await deleteMemory(database, 'm1');
    expect(await listMemory(database)).toEqual([]);
  });

  it('feeds avoided exercises into proposals', async () => {
    const context = await setup();
    await addMemory(
      context.database,
      { id: 'm1', kind: 'avoid_exercise', text: 'Не предлагать', exerciseId: 'leg-press' },
      NOW,
    );

    const current = await readCoachFacts(context.database, context.profile, NOW);

    expect(await listAvoidedExercises(context.database)).toEqual(['leg-press']);
    expect(current.avoided).toEqual(['leg-press']);
  });

  it('notices exercises removed repeatedly without treating them as preferences', async () => {
    const { database } = await setup();
    const engine = new WorkoutEngine({ database, createId, now: () => NOW });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const sessionId = await engine.startSession({
        operationId: randomUUID(),
        title: 'Т',
        programDayId: null,
        exercises: [{ exerciseId: 'burpee', plannedSets: 1, repsMin: 8, repsMax: 12 }],
      });
      const session = await engine.getSession(sessionId);
      await engine.removeExercise(session!.exercises[0].id, randomUUID());
      await engine.cancelSession(sessionId, randomUUID());
    }

    expect(await listFrequentlyRemoved(database, 2)).toEqual(['burpee']);
    expect(await listAvoidedExercises(database)).toEqual([]);
  });
});

describe('backup of the new records', () => {
  it('carries check-ins, steps, memory and decisions', async () => {
    const context = await setup();
    await saveCheckin(context.database, checkin({}), NOW);
    await saveSteps(context.database, '2026-11-16', 5000, NOW);
    await addMemory(context.database, { id: 'm1', kind: 'fact', text: 'Запись', exerciseId: null }, NOW);
    const backup = await exportAllData(context.database);

    await context.database.run('DELETE FROM daily_steps');
    await restoreAllData(context.database, backup);

    expect(await listSteps(context.database, 7)).toEqual([{ day: '2026-11-16', steps: 5000 }]);
    expect((await listMemory(context.database))[0].text).toBe('Запись');
    expect((await getCheckin(context.database, '2026-11-16'))?.energy).toBe(4);
  });
});
