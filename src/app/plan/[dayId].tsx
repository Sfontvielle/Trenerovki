import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { getProgram, removeProgramExercise } from '@/domains/program/program-repository';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatRepRange } from '@/lib/format';

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

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(day) =>
          day ? (
            <>
              <AppText accessibilityRole="header" variant="title">
                {day.name}
              </AppText>
              {day.exercises.map((exercise) => {
                const name = exerciseName(exercise.exerciseId);
                return (
                  <Panel key={exercise.id}>
                    <AppText variant="heading">{name}</AppText>
                    <AppText variant="callout" tone="secondary">
                      {`${exercise.targetSets} × ${formatRepRange(exercise.repsMin, exercise.repsMax)}`}
                    </AppText>
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
