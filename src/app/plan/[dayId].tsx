import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
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
      title: 'Убрать упражнение из плана?',
      message: name,
      confirmLabel: 'Убрать',
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
      setError(`Упражнение не убрано. ${describeFailure(cause)}`);
    }
  };

  const changeLink = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      state.reload();
    } catch (cause) {
      console.error(cause);
      setError(`Связь не изменена. ${describeFailure(cause)}`);
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
              {day.exercises.map((exercise, index) => {
                const name = exerciseName(exercise.exerciseId);
                const next = day.exercises[index + 1];
                const linked = Boolean(exercise.groupId && next?.groupId === exercise.groupId);
                const groupSize = day.exercises.filter(
                  ({ groupId }) => groupId && groupId === exercise.groupId,
                ).length;
                return (
                  <Panel key={exercise.id}>
                    <AppText variant="heading">{name}</AppText>
                    <AppText variant="callout" tone="secondary">
                      {describeTarget({
                        sets: exercise.targetSets,
                        repsMin: exercise.repsMin,
                        repsMax: exercise.repsMax,
                        durationSec: exercise.targetDurationSec,
                      })}
                    </AppText>
                    {groupSize > 1 ? (
                      <AppText variant="caption" tone="accent">
                        {groupLabel(groupSize)}
                      </AppText>
                    ) : null}
                    <View style={{ flexDirection: 'row', gap: theme.spacing.s }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          accessibilityLabel={`Заменить: ${name}`}
                          label="Заменить"
                          variant="secondary"
                          onPress={() =>
                            router.push({
                              pathname: '/plan/pick',
                              params: { dayId, replaceId: exercise.id },
                            })
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          accessibilityLabel={`Убрать: ${name}`}
                          disabled={day.exercises.length === 1}
                          label="Убрать"
                          variant="secondary"
                          onPress={() => remove(exercise.id, name)}
                        />
                      </View>
                    </View>
                    {next ? (
                      <Button
                        accessibilityLabel={`${linked ? 'Разъединить' : 'Объединить со следующим'}: ${name}`}
                        label={linked ? 'Разъединить' : 'Объединить со следующим'}
                        variant="secondary"
                        onPress={() =>
                          changeLink(() =>
                            linked
                              ? unlinkProgramExercise(database, exercise.id)
                              : linkProgramExerciseWithNext(database, exercise.id, createId),
                          )
                        }
                      />
                    ) : null}
                  </Panel>
                );
              })}
              {error ? (
                <AppText accessibilityLiveRegion="polite" tone="danger">
                  {error}
                </AppText>
              ) : null}
              <Button
                label="Добавить упражнение"
                variant="secondary"
                onPress={() => router.push({ pathname: '/plan/pick', params: { dayId } })}
              />
            </>
          ) : (
            <AppText tone="secondary">Этого дня больше нет в плане.</AppText>
          )
        }
      </DataView>
    </Screen>
  );
}
