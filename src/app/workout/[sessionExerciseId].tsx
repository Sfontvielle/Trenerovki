import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { SetLogger } from '@/features/workout/set-logger';
import { formatRepRange } from '@/lib/format';

export default function WorkoutExerciseScreen() {
  const { sessionExerciseId } = useLocalSearchParams<{ sessionExerciseId: string }>();
  const { engine } = useAppData();
  const { theme } = useTheme();

  const load = useCallback(async () => {
    const session = await engine.getOpenSession();
    const exercise = session?.exercises.find(({ id }) => id === sessionExerciseId);
    if (!session || !exercise) {
      return null;
    }
    const lastSets = await engine.getLastPerformance(exercise.exerciseId, session.id);
    return { session, exercise, lastSets };
  }, [engine, sessionExerciseId]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(data) => {
          if (!data) {
            return (
              <Panel>
                <AppText variant="heading">Упражнение недоступно</AppText>
                <AppText tone="secondary">Тренировка уже завершена или отменена.</AppText>
                <Button label="Открыть главную" variant="secondary" onPress={() => router.replace('/')} />
              </Panel>
            );
          }

          const { session, exercise, lastSets } = data;
          const reps = formatRepRange(exercise.repsMin, exercise.repsMax);

          return (
            <>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText accessibilityRole="header" variant="title">
                  {exerciseName(exercise.exerciseId)}
                </AppText>
                {reps ? (
                  <AppText tone="secondary">{`План: ${exercise.plannedSets} × ${reps}`}</AppText>
                ) : null}
              </View>
              <SetLogger
                key={`${exercise.id}-${exercise.sets.length}`}
                exercise={exercise}
                lastSets={lastSets}
                paused={session.state === 'paused'}
                onChanged={state.reload}
              />
              <Button label="К обзору тренировки" variant="secondary" onPress={() => router.back()} />
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
