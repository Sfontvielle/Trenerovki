import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { createId } from '@/domains/data-platform/ids';
import type { ProgramDay } from '@/domains/program/program-repository';
import type { WorkoutSession } from '@/domains/workout/types';
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
