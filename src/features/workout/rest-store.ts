import { useSyncExternalStore } from 'react';

import { exerciseTracking, findExercise } from '@/domains/exercises/catalog';
import { suggestRestSeconds } from '@/domains/workout/progression';
import type { SessionExercise, SetKind } from '@/domains/workout/types';
import { successFeedback } from '@/lib/haptics';
import { playRestFinished } from '@/lib/sounds';

const MIN_REMAINING_MS = 1000;
const HEAVY_REPS_LIMIT = 6;

export type RestState = {
  endsAt: number | null;
  totalMs: number;
};

const idle: RestState = { endsAt: null, totalMs: 0 };
const listeners = new Set<() => void>();
let state = idle;
let alarm: ReturnType<typeof setTimeout> | null = null;
let autoRestEnabled = true;

function publish(next: RestState) {
  if (alarm !== null) {
    clearTimeout(alarm);
    alarm = null;
  }
  state = next;
  if (next.endsAt !== null) {
    alarm = setTimeout(finish, Math.max(0, next.endsAt - Date.now()));
  }
  listeners.forEach((listener) => listener());
}

function finish() {
  publish(idle);
  successFeedback();
  playRestFinished();
}

// One timer for the whole app: it survives leaving the workout screen, and it
// counts down to a clock time, so a locked phone loses nothing.
export const restTimer = {
  start(seconds: number) {
    publish({ endsAt: Date.now() + seconds * 1000, totalMs: seconds * 1000 });
  },
  adjust(seconds: number) {
    if (state.endsAt === null) {
      return;
    }
    publish({
      endsAt: Math.max(Date.now() + MIN_REMAINING_MS, state.endsAt + seconds * 1000),
      totalMs: Math.max(state.totalMs + seconds * 1000, MIN_REMAINING_MS),
    });
  },
  stop() {
    publish(idle);
  },
};

export function setAutoRestEnabled(enabled: boolean) {
  autoRestEnabled = enabled;
}

export function restSecondsFor(exercise: SessionExercise) {
  return suggestRestSeconds({
    isolation: findExercise(exercise.exerciseId)?.isolation ?? false,
    timed: exerciseTracking(exercise.exerciseId) !== 'reps',
    heavy: (exercise.repsMax ?? Number.POSITIVE_INFINITY) <= HEAVY_REPS_LIMIT,
  });
}

// In a superset the rest comes after the last exercise of the round.
export function restAfterSet(exercise: SessionExercise, exercises: SessionExercise[], kind: SetKind) {
  const group = exercise.groupId ? exercises.filter(({ groupId }) => groupId === exercise.groupId) : [];
  const midRound = group.length > 1 && group.at(-1)?.id !== exercise.id;
  if (autoRestEnabled && kind !== 'warmup' && !midRound) {
    restTimer.start(restSecondsFor(exercise));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRestTimer() {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}
