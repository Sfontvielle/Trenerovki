import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { AppText, Screen } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName, findExercise } from '@/domains/exercises/catalog';
import { targetFor } from '@/domains/program/generate-plan';
import { addProgramExercise, replaceProgramExercise } from '@/domains/program/program-repository';
import { ExerciseList } from '@/features/exercises/exercise-list';
import { limitationLabels } from '@/features/profile/labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { t } from '@/lib/i18n';

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
          title: t('Упражнение нагружает зону из ваших ограничений'),
          message: t('{0}. Заметная нагрузка: {1}. Добавить в план?', { 0: exerciseName(exerciseId), 1: zones.map((area) => limitationLabels[area]).join(', ') }),
          confirmLabel: t('Добавить'),
        });
        if (!approved) {
          return;
        }
      }

      const target = targetFor(exerciseId, profile?.goal ?? 'muscle', profile?.experience ?? 'intermediate');
      if (replaceId) {
        await replaceProgramExercise(database, replaceId, exerciseId, target);
      } else {
        await addProgramExercise(database, dayId, exerciseId, createId(), target);
      }
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(t('План не изменён. {0}', { 0: describeFailure(cause) }));
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
