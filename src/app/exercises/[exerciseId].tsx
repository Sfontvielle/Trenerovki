import { router, useLocalSearchParams } from 'expo-router';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, Panel, Screen } from '@/design-system';
import { exerciseName, findExercise, muscleGroupLabels } from '@/domains/exercises/catalog';
import { techniqueCues } from '@/domains/exercises/technique';
import { equipmentLabels, limitationLabels } from '@/features/profile/labels';

export default function ExerciseDetailsScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { profile } = useAppData();
  const exercise = findExercise(exerciseId);
  const cues = techniqueCues[exerciseId] ?? [];
  const restricted = exercise?.loads.filter((area) => profile?.limitations.includes(area)) ?? [];

  return (
    <Screen scroll belowHeader>
      <AppText accessibilityRole="header" variant="title">
        {exerciseName(exerciseId)}
      </AppText>

      {exercise ? (
        <Panel>
          <AppText variant="callout" tone="secondary">
            {`Мышцы: ${muscleGroupLabels[exercise.muscleGroup]}`}
          </AppText>
          <AppText variant="callout" tone="secondary">
            {`Условия: ${exercise.equipment.map((item) => equipmentLabels[item]).join(', ')}`}
          </AppText>
          {exercise.loads.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              {`Заметная нагрузка: ${exercise.loads.map((area) => limitationLabels[area]).join(', ')}`}
            </AppText>
          ) : null}
        </Panel>
      ) : (
        <AppText tone="secondary">Это ваше упражнение, описания техники для него нет.</AppText>
      )}

      {restricted.length > 0 ? (
        <AppText tone="warning">Упражнение отмечено для зоны из ваших ограничений.</AppText>
      ) : null}

      {cues.length > 0 ? (
        <Panel>
          <AppText variant="heading">Как выполнять</AppText>
          {cues.map((cue) => (
            <AppText key={cue} tone="secondary">
              {cue}
            </AppText>
          ))}
        </Panel>
      ) : null}

      <AppText variant="caption" tone="secondary">
        Краткая памятка, экспертной проверки пока не было. При боли прекратите упражнение.
      </AppText>

      <Button
        label="Моя динамика"
        variant="secondary"
        onPress={() => router.push(`/exercise-progress/${exerciseId}`)}
      />
    </Screen>
  );
}
