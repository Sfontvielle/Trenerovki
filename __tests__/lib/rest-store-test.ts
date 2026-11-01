import { restAfterSet, restSecondsFor, restTimer, setAutoRestEnabled, useRestTimer } from '@/features/workout/rest-store';
import type { SessionExercise } from '@/domains/workout/types';
import { playRestFinished } from '@/lib/sounds';
import { successFeedback } from '@/lib/haptics';
import { act, renderHook } from '@testing-library/react-native';

jest.mock('@/lib/sounds', () => ({ playRestFinished: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ successFeedback: jest.fn() }));

function makeExercise(changes: Partial<SessionExercise>): SessionExercise {
  return {
    id: 'one',
    exerciseId: 'lateral-raise',
    position: 1,
    plannedSets: 3,
    repsMin: 10,
    repsMax: 15,
    targetDurationSec: null,
    groupId: null,
    sets: [],
    ...changes,
  } as SessionExercise;
}

describe('rest timer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(playRestFinished).mockClear();
    jest.mocked(successFeedback).mockClear();
    setAutoRestEnabled(true);
  });

  afterEach(() => {
    restTimer.stop();
    jest.useRealTimers();
  });

  it('signals the end once and clears itself', async () => {
    const { result } = await renderHook(() => useRestTimer());

    await act(async () => {
      restTimer.start(60);
    });
    expect(result.current.endsAt).not.toBeNull();

    await act(async () => {
      jest.advanceTimersByTime(59_000);
    });
    expect(playRestFinished).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2_000);
    });
    expect(playRestFinished).toHaveBeenCalledTimes(1);
    expect(successFeedback).toHaveBeenCalledTimes(1);
    expect(result.current.endsAt).toBeNull();
  });

  it('moves the end when the time is adjusted', () => {
    restTimer.start(60);
    restTimer.adjust(15);

    jest.advanceTimersByTime(70_000);
    expect(playRestFinished).not.toHaveBeenCalled();

    jest.advanceTimersByTime(6_000);
    expect(playRestFinished).toHaveBeenCalledTimes(1);
  });

  it('never adjusts below a moment of rest', () => {
    restTimer.start(30);
    restTimer.adjust(-600);

    jest.advanceTimersByTime(500);
    expect(playRestFinished).not.toHaveBeenCalled();

    jest.advanceTimersByTime(600);
    expect(playRestFinished).toHaveBeenCalledTimes(1);
  });

  it('stays silent after being stopped', () => {
    restTimer.start(30);
    restTimer.stop();

    jest.advanceTimersByTime(60_000);

    expect(playRestFinished).not.toHaveBeenCalled();
  });

  it('starts over instead of running twice', () => {
    restTimer.start(30);
    restTimer.start(30);

    jest.advanceTimersByTime(31_000);

    expect(playRestFinished).toHaveBeenCalledTimes(1);
  });

  it('picks the rest from the exercise', () => {
    expect(restSecondsFor(makeExercise({ exerciseId: 'lateral-raise' }))).toBe(75);
    expect(restSecondsFor(makeExercise({ exerciseId: 'bench-press', repsMax: 5 }))).toBe(180);
    expect(restSecondsFor(makeExercise({ exerciseId: 'plank', repsMax: null }))).toBe(45);
  });

  it('waits for the end of a superset round', () => {
    const first = makeExercise({ id: 'first', groupId: 'group' });
    const second = makeExercise({ id: 'second', groupId: 'group' });

    restAfterSet(first, [first, second], 'working');
    jest.advanceTimersByTime(200_000);
    expect(playRestFinished).not.toHaveBeenCalled();

    restAfterSet(second, [first, second], 'working');
    jest.advanceTimersByTime(200_000);
    expect(playRestFinished).toHaveBeenCalledTimes(1);
  });

  it('adds no rest after a warm-up or when switched off', () => {
    const exercise = makeExercise({});

    restAfterSet(exercise, [exercise], 'warmup');
    setAutoRestEnabled(false);
    restAfterSet(exercise, [exercise], 'working');
    jest.advanceTimersByTime(200_000);

    expect(playRestFinished).not.toHaveBeenCalled();
  });
});
