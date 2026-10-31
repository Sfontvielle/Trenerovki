import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { AppText, Screen } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName, findExercise } from '@/domains/exercises/catalog';
import { repRangeFor } from '@/domains/program/generate-plan';
import { addProgramExercise, replaceProgramExercise } from '@/domains/program/program-repository';
import { ExerciseList } from '@/features/exercises/exercise-list';
import { limitationLabels } from '@/features/profile/labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';

export default function PickPlanExerciseScreen() {
  const { dayId, replaceId } = useLocalSearchParams<{ dayId: string; replaceId?: string }>();
  const { database, profile } = useAppData();
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);

  const pick = async (exerciseId: string) => {
    if (saving.current) {
      return;
    }
    saving.current = true;
    setError(null);
    try {
      const zones = findExercise(exerciseId)?.loads.filter((area) => profile?.limitations.includes(area)) ?? [];
      if (zones.length > 0) {
        const approved = await confirm({
          title: 'Упражнение нагружает зону из ваших ограничений',
          message: `${exerciseName(exerciseId)}. Заметная нагрузка: ${zones.map((area) => limitationLabels[area]).join(', ')}. Добавить в план?`,
          confirmLabel: 'Добавить',
        });
        if (!approved) {
          return;
        }
      }

      const range = repRangeFor(exerciseId, profile?.goal ?? 'muscle', profile?.experience ?? 'intermediate');
      if (replaceId) {
        await replaceProgramExercise(database, replaceId, exerciseId, range);
      } else {
        await addProgramExercise(database, dayId, exerciseId, createId(), range);
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
