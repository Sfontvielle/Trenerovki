import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { getDeloadUntil, isDeloadActive } from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import { dayKey } from '@/domains/nutrition/nutrition';
import type { ProgramDay } from '@/domains/program/program-repository';
import type { WorkoutSession } from '@/domains/workout/types';
import { describeFailure } from '@/lib/describe-failure';

export function useStartWorkout() {
  const { database, engine } = useAppData();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (title: string, day: ProgramDay | null) => {
    setStarting(true);
    setError(null);
    try {
      const deload = isDeloadActive(await getDeloadUntil(database), dayKey(new Date()));
      await engine.startSession({
        operationId: createId(),
        title,
        programDayId: day?.id ?? null,
        exercises: (day?.exercises ?? []).map((exercise) => ({
          exerciseId: exercise.exerciseId,
          plannedSets: deload ? Math.max(1, exercise.targetSets - 1) : exercise.targetSets,
          repsMin: exercise.repsMin,
          repsMax: exercise.repsMax,
          targetDurationSec: exercise.targetDurationSec,
          groupId: exercise.groupId,
        })),
      });
      router.push('/workout');
    } catch (cause) {
      console.error(cause);
      setError(`Тренировка не началась. ${describeFailure(cause)}`);
    } finally {
      setStarting(false);
    }
  };

  const repeat = async (session: WorkoutSession) => {
    setStarting(true);
    setError(null);
    try {
      await engine.startSession({
        operationId: createId(),
        title: session.title,
        programDayId: null,
        exercises: session.exercises.map((exercise) => ({
          exerciseId: exercise.exerciseId,
          plannedSets: exercise.plannedSets ?? exercise.sets.length,
          repsMin: exercise.repsMin,
          repsMax: exercise.repsMax,
          targetDurationSec: exercise.targetDurationSec,
          groupId: exercise.groupId,
        })),
      });
      router.replace('/workout');
    } catch (cause) {
      console.error(cause);
      setError(`Тренировка не началась. ${describeFailure(cause)}`);
    } finally {
      setStarting(false);
    }
  };

  return { start, repeat, starting, error };
}
