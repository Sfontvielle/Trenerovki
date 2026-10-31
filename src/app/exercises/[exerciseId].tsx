import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { MuscleMap } from '@/components/muscle-map';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { addMemory, deleteMemory, listMemory } from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import {
  categoryLabels,
  exerciseName,
  findAlternatives,
  findExercise,
  muscleGroupLabels,
  muscleLabels,
} from '@/domains/exercises/catalog';
import { techniqueCues } from '@/domains/exercises/technique';
import { readyForDemanding } from '@/domains/profile/profile';
import { equipmentLabels, limitationLabels } from '@/features/profile/labels';
import { describeFailure } from '@/lib/describe-failure';
import { t } from '@/lib/i18n';

export default function ExerciseDetailsScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { database, profile } = useAppData();
  const { theme } = useTheme();
  const exercise = findExercise(exerciseId);
  const cues = techniqueCues[exerciseId] ?? [];
  const restricted = exercise?.loads.filter((area) => profile?.limitations.includes(area)) ?? [];

  const load = useCallback(async () => {
    const memory = await listMemory(database);
    return {
      own: memory.find((entry) => entry.exerciseId === exerciseId) ?? null,
      excluded: memory.flatMap((entry) => (entry.exerciseId ? [entry.exerciseId] : [])),
    };
  }, [database, exerciseId]);
  const avoided = useScreenData(load);
  const alternatives =
    profile && avoided.status === 'ready'
      ? findAlternatives(exerciseId, {
          equipment: profile.equipment,
          limitations: profile.limitations,
          allowDemanding: readyForDemanding(profile),
          excluded: avoided.data.excluded,
        })
      : [];

  const toggleAvoided = async () => {
    try {
      if (avoided.status === 'ready' && avoided.data.own) {
        await deleteMemory(database, avoided.data.own.id);
      } else {
        await addMemory(
          database,
          {
            id: createId(),
            kind: 'avoid_exercise',
            text: t('Не предлагать: {0}', { 0: exerciseName(exerciseId) }),
            exerciseId,
          },
          new Date(),
        );
      }
      avoided.reload();
    } catch (cause) {
      console.error(cause, describeFailure(cause));
    }
  };

  return (
    <Screen scroll belowHeader>
      <AppText accessibilityRole="header" variant="title">
        {exerciseName(exerciseId)}
      </AppText>

      {exercise ? (
        <>
          <Panel>
            <MuscleMap
              primary={exercise.primary}
              secondary={exercise.secondary}
              summary={t('Схема мышц. Основные: {0}', { 0: exercise.primary.map((muscle) => muscleLabels[muscle]).join(', ') })}
            />
            <AppText variant="callout" tone="secondary">
              {t('Основные мышцы: {0}', { 0: exercise.primary.map((muscle) => muscleLabels[muscle]).join(', ') })}
            </AppText>
            {exercise.secondary.length > 0 ? (
              <AppText variant="callout" tone="secondary">
                {t('Помогают: {0}', { 0: exercise.secondary.map((muscle) => muscleLabels[muscle]).join(', ') })}
              </AppText>
            ) : null}
          </Panel>
          <Panel>
            <AppText variant="callout" tone="secondary">
              {t('Раздел: {0}, {1}', { 0: categoryLabels[exercise.category], 1: muscleGroupLabels[exercise.muscleGroup].toLowerCase() })}
            </AppText>
            <AppText variant="callout" tone="secondary">
              {t('Условия: {0}', { 0: exercise.equipment.map((item) => equipmentLabels[item]).join(', ') })}
            </AppText>
            {exercise.loads.length > 0 ? (
              <AppText variant="callout" tone="secondary">
                {t('Заметная нагрузка: {0}', { 0: exercise.loads.map((area) => limitationLabels[area]).join(', ') })}
              </AppText>
            ) : null}
            {exercise.demanding ? (
              <AppText variant="callout" tone="secondary">
                {t('Технически сложное упражнение: начинайте с лёгкого веса.')}
              </AppText>
            ) : null}
          </Panel>
        </>
      ) : (
        <AppText tone="secondary">{t('Это ваше упражнение, описания техники для него нет.')}</AppText>
      )}

      {restricted.length > 0 ? (
        <AppText tone="warning">{t('По нашей разметке это упражнение заметно нагружает зону из ваших ограничений: {0}.', { 0: restricted.map((area) => limitationLabels[area]).join(', ') })}</AppText>
      ) : null}

      {cues.length > 0 ? (
        <Panel>
          <AppText variant="heading">{t('Как выполнять')}</AppText>
          {cues.map((cue) => (
            <AppText key={cue} tone="secondary">
              {cue}
            </AppText>
          ))}
        </Panel>
      ) : null}

      <AppText variant="caption" tone="secondary">
        {t('{0}При боли прекратите упражнение. Если появились боль в груди, сильная одышка, головокружение или слабость, остановите тренировку и обратитесь за неотложной помощью.', { 0: cues.length > 0 ? t('Краткая памятка. Специалист её пока не проверял. ') : '' })}
      </AppText>

      {alternatives.length > 0 ? (
        <View style={{ gap: theme.spacing.s }}>
          <AppText accessibilityRole="header" variant="heading">
            {t('Чем заменить')}
          </AppText>
          {alternatives.map((option) => (
            <Pressable
              key={option.id}
              accessibilityRole="button"
              onPress={() => router.push(`/exercises/${option.id}`)}
            >
              <Panel>
                <AppText>{option.name}</AppText>
              </Panel>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Button
        label={t('Моя динамика')}
        variant="secondary"
        onPress={() => router.push(`/exercise-progress/${exerciseId}`)}
      />
      {exercise ? (
        <Button
          label={avoided.status === 'ready' && avoided.data.own ? t('Снова предлагать это упражнение') : t('Не предлагать это упражнение')}
          variant="secondary"
          onPress={toggleAvoided}
        />
      ) : null}
    </Screen>
  );
}
