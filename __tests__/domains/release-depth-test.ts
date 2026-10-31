import {
  WrongPasswordError,
  decryptBackup,
  encryptBackup,
  isEncryptedBackup,
} from '@/domains/data-platform/backup-crypto';
import { migrate } from '@/domains/data-platform/migrations';
import { average, getCardioTotals, listSetsByGroup, listWeeks, weeksInARow } from '@/domains/progress/analytics';
import { exportWorkoutsCsv } from '@/domains/progress/workout-csv';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

const NOW = new Date('2026-11-16T10:00:00.000Z');
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const FAST = 10;

let nextId = 0;
const createId = () => `id-${++nextId}`;
const randomBytes = (count: number) => Uint8Array.from({ length: count }, (_, index) => (index * 7 + 3) % 256);

describe('encrypted backups', () => {
  it('round-trips text, including Cyrillic', async () => {
    const encrypted = await encryptBackup('{"name":"Ислам"}', 'длинный пароль', randomBytes, FAST);

    expect(isEncryptedBackup(encrypted)).toBe(true);
    expect(encrypted).not.toContain('Ислам');
    expect(await decryptBackup(encrypted, 'длинный пароль')).toBe('{"name":"Ислам"}');
  });

  it('refuses a wrong password', async () => {
    const encrypted = await encryptBackup('secret', 'правильный', randomBytes, FAST);

    await expect(decryptBackup(encrypted, 'неправильный')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detects tampering', async () => {
    const parsed = JSON.parse(await encryptBackup('secret', 'password', randomBytes, FAST));
    parsed.ciphertext = `00${parsed.ciphertext.slice(2)}`;

    await expect(decryptBackup(JSON.stringify(parsed), 'password')).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('tells plain backups and other files apart', () => {
    expect(isEncryptedBackup('{"format":"ironvant-export"}')).toBe(false);
    expect(isEncryptedBackup('not json')).toBe(false);
  });
});

async function setup() {
  const database = createTestDatabase();
  await migrate(database);
  const clock = { time: NOW.getTime() };
  const engine = new WorkoutEngine({ database, createId, now: () => new Date(clock.time) });

  const workout = async (exerciseId: string, set: Parameters<WorkoutEngine['logSet']>[1]) => {
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Т',
      programDayId: null,
      exercises: [{ exerciseId, plannedSets: 1, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    await engine.logSet(session!.exercises[0].id, set, createId());
    await engine.completeSession(sessionId, createId());
  };
  return { clock, database, workout };
}

describe('analytics', () => {
  it('groups workouts and volume by week', async () => {
    const { clock, database, workout } = await setup();
    await workout('bench-press', { weightKg: 50, reps: 10, rir: 2 });
    clock.time += WEEK_MS;
    await workout('bench-press', { weightKg: 60, reps: 10, rir: 2 });

    const weeks = await listWeeks(database, new Date(clock.time + 1), 3);

    expect(weeks).toEqual([
      { weeksAgo: 2, workouts: 0, volumeKg: 0 },
      { weeksAgo: 1, workouts: 1, volumeKg: 500 },
      { weeksAgo: 0, workouts: 1, volumeKg: 600 },
    ]);
  });

  it('counts weeks in a row and forgives a quiet current week', () => {
    const week = (weeksAgo: number, workouts: number) => ({ weeksAgo, workouts, volumeKg: 0 });

    expect(weeksInARow([week(3, 1), week(2, 0), week(1, 2), week(0, 1)])).toBe(2);
    expect(weeksInARow([week(2, 1), week(1, 1), week(0, 0)])).toBe(2);
    expect(weeksInARow([week(1, 0), week(0, 0)])).toBe(0);
  });

  it('counts sets per muscle group and leaves out warm-ups and mobility', async () => {
    const { database, workout } = await setup();
    await workout('bench-press', { weightKg: 50, reps: 10, rir: 2 });
    await workout('bench-press', { weightKg: 20, reps: 10, rir: null, kind: 'warmup' });
    await workout('cat-cow', { weightKg: null, reps: null, rir: null, durationSec: 60 });

    expect(await listSetsByGroup(database, new Date(NOW.getTime() - WEEK_MS))).toEqual([{ group: 'chest', sets: 1 }]);
  });

  it('adds up cardio time and distance', async () => {
    const { database, workout } = await setup();
    await workout('running', { weightKg: null, reps: null, rir: null, durationSec: 1200, distanceM: 3000 });

    expect(await getCardioTotals(database, new Date(NOW.getTime() - WEEK_MS))).toEqual({ seconds: 1200, meters: 3000 });
  });

  it('averages only what exists', () => {
    expect(average([])).toBeNull();
    expect(average([2, 4])).toBe(3);
  });
});

describe('workouts as a table', () => {
  it('writes one row per set with a header', async () => {
    const { database, workout } = await setup();
    await workout('bench-press', { weightKg: 50, reps: 10, rir: 2, note: 'легко, с запасом' });

    const lines = (await exportWorkoutsCsv(database)).split('\n');

    expect(lines[0]).toBe('date,workout,exercise,set,kind,weight_kg,reps,rir,duration_sec,distance_m,note');
    expect(lines[1]).toContain('Жим штанги лёжа,1,working,50,10,2,,,"легко, с запасом"');
  });

  it('does not let a note run as a spreadsheet formula', async () => {
    const { database, workout } = await setup();
    await workout('bench-press', { weightKg: 50, reps: 10, rir: 2, note: '=1+1' });

    expect((await exportWorkoutsCsv(database)).split('\n')[1]).toContain("'=1+1");
  });
});
