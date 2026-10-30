import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { createId } from '@/domains/data-platform/ids';
import type { ProgramDay } from '@/domains/program/program-repository';
import { describeFailure } from '@/lib/describe-failure';

export function useStartWorkout() {
  const { engine } = useAppData();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async (title: string, day: ProgramDay | null) => {
    setStarting(true);
    setError(null);
    try {
      await engine.startSession({
        operationId: createId(),
        title,
        programDayId: day?.id ?? null,
        exercises: (day?.exercises ?? []).map((exercise) => ({
          exerciseId: exercise.exerciseId,
          plannedSets: exercise.targetSets,
          repsMin: exercise.repsMin,
          repsMax: exercise.repsMax,
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

  return { start, starting, error };
}
