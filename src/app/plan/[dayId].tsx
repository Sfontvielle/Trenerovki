import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, ListGroup, Screen, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { createId } from '@/domains/data-platform/ids';
import {
  getProgram,
  linkProgramExerciseWithNext,
  removeProgramExercise,
  unlinkProgramExercise,
} from '@/domains/program/program-repository';
import { describeTarget, groupLabel } from '@/features/workout/set-labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { t } from '@/lib/i18n';

export default function EditPlanDayScreen() {
  const { dayId } = useLocalSearchParams<{ dayId: string }>();
  const { database } = useAppData();
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const program = await getProgram(database);
    return program.find((day) => day.id === dayId) ?? null;
  }, [database, dayId]);
  const state = useScreenData(load);

  const remove = async (id: string, name: string) => {
    const approved = await confirm({
      title: t('Убрать упражнение из плана?'),
      message: name,
      confirmLabel: t('Убрать'),
      destructive: true,
    });
    if (!approved) {
      return;
    }
    setError(null);
    try {
      await removeProgramExercise(database, id);
      state.reload();
    } catch (cause) {
      console.error(cause);
      setError(t('Упражнение не убрано. {0}', { 0: describeFailure(cause) }));
    }
  };

  const changeLink = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      state.reload();
    } catch (cause) {
      console.error(cause);
      setError(t('Связь не изменена. {0}', { 0: describeFailure(cause) }));
    }
  };

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(day) =>
          day ? (
            <>
              <AppText accessibilityRole="header" variant="title">
                {day.name}
              </AppText>
              <ListGroup>
              {day.exercises.map((exercise, index) => {
                const name = exerciseName(exercise.exerciseId);
                const next = day.exercises[index + 1];
                const linked = Boolean(exercise.groupId && next?.groupId === exercise.groupId);
                const groupSize = day.exercises.filter(
                  ({ groupId }) => groupId && groupId === exercise.groupId,
                ).length;
                return (
                  <View key={exercise.id} style={{ gap: theme.spacing.xs, padding: theme.spacing.m }}>
                    <AppText>{name}</AppText>
                    <AppText variant="callout" tone="secondary">
                      {[
                        describeTarget({
                          sets: exercise.targetSets,
                          repsMin: exercise.repsMin,
                          repsMax: exercise.repsMax,
                          durationSec: exercise.targetDurationSec,
                        }),
                        groupSize > 1 ? groupLabel(groupSize) : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </AppText>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                      <Button
                        accessibilityLabel={t('Заменить: {0}', { 0: name })}
                        label={t('Заменить')}
                        variant="plain"
                        onPress={() =>
                          router.push({
                            pathname: '/plan/pick',
                            params: { dayId, replaceId: exercise.id },
                          })
                        }
                      />
                      {next ? (
                        <Button
                          accessibilityLabel={`${linked ? t('Разъединить') : t('Объединить со следующим')}: ${name}`}
                          label={linked ? t('Разъединить') : t('В суперсет')}
                          variant="plain"
                          onPress={() =>
                            changeLink(() =>
                              linked
                                ? unlinkProgramExercise(database, exercise.id)
                                : linkProgramExerciseWithNext(database, exercise.id, createId),
                            )
                          }
                        />
                      ) : null}
                      <Button
                        accessibilityLabel={t('Убрать: {0}', { 0: name })}
                        disabled={day.exercises.length === 1}
                        label={t('Убрать')}
                        variant="danger"
                        onPress={() => remove(exercise.id, name)}
                      />
                    </View>
                  </View>
                );
              })}
              </ListGroup>
              {error ? (
                <AppText accessibilityLiveRegion="polite" tone="danger">
                  {error}
                </AppText>
              ) : null}
              <Button
                label={t('Добавить упражнение')}
                variant="secondary"
                onPress={() => router.push({ pathname: '/plan/pick', params: { dayId } })}
              />
            </>
          ) : (
            <AppText tone="secondary">{t('Этого дня больше нет в плане.')}</AppText>
          )
        }
      </DataView>
    </Screen>
  );
}
