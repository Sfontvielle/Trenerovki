import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { AppText, Screen } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { addProgramExercise, replaceProgramExercise } from '@/domains/program/program-repository';
import { ExerciseList } from '@/features/exercises/exercise-list';
import { describeFailure } from '@/lib/describe-failure';

export default function PickPlanExerciseScreen() {
  const { dayId, replaceId } = useLocalSearchParams<{ dayId: string; replaceId?: string }>();
  const { database } = useAppData();
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  const pick = async (exerciseId: string) => {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setError(null);
    try {
      if (replaceId) {
        await replaceProgramExercise(database, replaceId, exerciseId);
      } else {
        await addProgramExercise(database, dayId, exerciseId, createId());
      }
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`План не изменён. ${describeFailure(cause)}`);
    } finally {
      saving.current = false;
    }
  };

  return (
    <Screen scroll belowHeader>
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <ExerciseList onPick={pick} />
    </Screen>
  );
}
