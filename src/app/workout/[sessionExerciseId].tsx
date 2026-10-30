import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName } from '@/domains/exercises/catalog';
import { SetLogger } from '@/features/workout/set-logger';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatRepRange } from '@/lib/format';
import { returnToTabs } from '@/lib/navigation';

export default function WorkoutExerciseScreen() {
  const { sessionExerciseId } = useLocalSearchParams<{ sessionExerciseId: string }>();
  const { engine } = useAppData();
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = await engine.getOpenSession();
    const exercise = session?.exercises.find(({ id }) => id === sessionExerciseId);
    if (!session || !exercise) {
      return null;
    }
    const [lastSets, discomfort] = await Promise.all([
      engine.getLastPerformance(exercise.exerciseId, session.id),
      engine.hasRecentDiscomfort(exercise.exerciseId),
    ]);
    return { session, exercise, lastSets, discomfort };
  }, [engine, sessionExerciseId]);
  const state = useScreenData(load);

  const reportDiscomfort = async () => {
    const approved = await confirm({
      title: 'Остановите упражнение',
      message:
        'Если боль сильная, резкая или не проходит, прекратите тренировку и обратитесь к врачу. IRONVANT не ставит диагнозы. Отметить дискомфорт? Мы не будем предлагать прибавку веса в этом упражнении 14 дней.',
      confirmLabel: 'Отметить',
    });
    if (!approved) {
      return;
    }
    setError(null);
    try {
      await engine.reportDiscomfort(sessionExerciseId, createId());
      state.reload();
    } catch (cause) {
      console.error(cause);
      setError(`Отметка не сохранена. ${describeFailure(cause)}`);
    }
  };

  const removeFromWorkout = async () => {
    setError(null);
    try {
      await engine.removeExercise(sessionExerciseId, createId());
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Упражнение не убрано. ${describeFailure(cause)}`);
    }
  };

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(data) => {
          if (!data) {
            return (
              <Panel>
                <AppText variant="heading">Упражнение недоступно</AppText>
                <AppText tone="secondary">Тренировка уже завершена или отменена.</AppText>
                <Button label="Открыть главную" variant="secondary" onPress={returnToTabs} />
              </Panel>
            );
          }

          const { session, exercise, lastSets, discomfort } = data;
          const reps = formatRepRange(exercise.repsMin, exercise.repsMax);
          const paused = session.state === 'paused';
          const setsSignature = exercise.sets
            .map((set) => `${set.id}:${set.weightKg}:${set.reps}:${set.rir}`)
            .join('|');

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

              {discomfort ? (
                <AppText tone="warning">
                  Вы отмечали дискомфорт в этом упражнении, поэтому прибавку веса мы не предлагаем.
                </AppText>
              ) : null}

              <SetLogger
                key={`${exercise.id}-${setsSignature}`}
                exercise={exercise}
                lastSets={lastSets}
                paused={paused}
                suggestionsAllowed={!discomfort}
                onChanged={state.reload}
              />

              {error ? (
                <AppText accessibilityLiveRegion="polite" tone="danger">
                  {error}
                </AppText>
              ) : null}

              <Button label="Боль или дискомфорт" variant="secondary" onPress={reportDiscomfort} />
              {exercise.sets.length === 0 && !paused ? (
                <Button label="Убрать из тренировки" variant="secondary" onPress={removeFromWorkout} />
              ) : null}
              <Button label="К обзору тренировки" variant="secondary" onPress={() => router.back()} />
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
