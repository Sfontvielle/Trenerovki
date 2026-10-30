import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { createId } from '@/domains/data-platform/ids';
import type { ProgramDay } from '@/domains/program/program-repository';

export function useStartWorkout() {
  const { engine } = useAppData();
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);

  const start = async (title: string, day: ProgramDay | null) => {
    setStarting(true);
    setFailed(false);
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
    } catch (error) {
      console.error(error);
      setFailed(true);
    } finally {
      setStarting(false);
    }
  };

  return { start, starting, failed };
}
