import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { getDeloadUntil, isDeloadActive } from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import { dayKey } from '@/domains/nutrition/nutrition';
import { exerciseName, exerciseTracking, findExercise } from '@/domains/exercises/catalog';
import { suggestRestSeconds } from '@/domains/workout/progression';
import { RestTimer } from '@/features/workout/rest-timer';
import { describeTarget, groupLabel } from '@/features/workout/set-labels';
import { SetLogger } from '@/features/workout/set-logger';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { returnToTabs } from '@/lib/navigation';
import { t } from '@/lib/i18n';

const HEAVY_REPS_LIMIT = 6;

export default function WorkoutExerciseScreen() {
  const { sessionExerciseId } = useLocalSearchParams<{ sessionExerciseId: string }>();
  const { database, engine } = useAppData();
  const { theme } = useTheme();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const session = await engine.getOpenSession();
    const exercise = session?.exercises.find(({ id }) => id === sessionExerciseId);
    if (!session || !exercise) {
      return null;
    }
    const [recentSets, discomfort, deloadUntil] = await Promise.all([
      engine.getRecentPerformances(exercise.exerciseId, 2, session.id),
      engine.hasRecentDiscomfort(exercise.exerciseId),
      getDeloadUntil(database),
    ]);
    return { session, exercise, recentSets, discomfort, deload: isDeloadActive(deloadUntil, dayKey(new Date())) };
  }, [database, engine, sessionExerciseId]);
  const state = useScreenData(load);

  const reportDiscomfort = async () => {
    const approved = await confirm({
      title: t('Остановите упражнение'),
      message:
        t('Если боль сильная, резкая или не проходит, прекратите тренировку и обратитесь к врачу. При боли в груди, сильной одышке, головокружении или слабости сразу обратитесь за неотложной помощью. IRONVANT не ставит диагнозы. Отметить дискомфорт? Мы не будем предлагать прибавку веса в этом упражнении 14 дней.'),
      confirmLabel: t('Отметить'),
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
      setError(t('Отметка не сохранена. {0}', { 0: describeFailure(cause) }));
    }
  };

  const removeFromWorkout = async () => {
    setError(null);
    try {
      await engine.removeExercise(sessionExerciseId, createId());
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(t('Упражнение не убрано. {0}', { 0: describeFailure(cause) }));
    }
  };

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(data) => {
          if (!data) {
            return (
              <Panel>
                <AppText variant="heading">{t('Упражнение недоступно')}</AppText>
                <AppText tone="secondary">{t('Тренировка уже завершена или отменена.')}</AppText>
                <Button label={t('Открыть главную')} variant="secondary" onPress={returnToTabs} />
              </Panel>
            );
          }

          const { session, exercise, recentSets, discomfort, deload } = data;
          const target = describeTarget({
            sets: exercise.plannedSets,
            repsMin: exercise.repsMin,
            repsMax: exercise.repsMax,
            durationSec: exercise.targetDurationSec,
          });
          const paused = session.state === 'paused';
          const group = exercise.groupId
            ? session.exercises.filter(({ groupId }) => groupId === exercise.groupId)
            : [];
          const next = group[(group.findIndex(({ id }) => id === exercise.id) + 1) % Math.max(group.length, 1)];
          const restSeconds = suggestRestSeconds({
            isolation: findExercise(exercise.exerciseId)?.isolation ?? false,
            timed: exerciseTracking(exercise.exerciseId) !== 'reps',
            heavy: (exercise.repsMax ?? Number.POSITIVE_INFINITY) <= HEAVY_REPS_LIMIT,
          });
          const setsSignature = exercise.sets
            .map((set) => `${set.id}:${set.weightKg}:${set.reps}:${set.rir}:${set.kind}:${set.note}:${set.durationSec}:${set.distanceM}`)
            .join('|');

          return (
            <>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText accessibilityRole="header" variant="title">
                  {exerciseName(exercise.exerciseId)}
                </AppText>
                {target ? <AppText tone="secondary">{t('План: {0}', { 0: target })}</AppText> : null}
                {group.length > 1 ? (
                  <AppText tone="accent">{t('{0}: {1} из {2}', { 0: groupLabel(group.length), 1: group.indexOf(exercise) + 1, 2: group.length })}</AppText>
                ) : null}
              </View>

              {discomfort ? (
                <AppText tone="warning">
                  {t('Вы отмечали дискомфорт в этом упражнении, поэтому прибавку веса мы не предлагаем.')}
                </AppText>
              ) : null}

              <SetLogger
                key={`${exercise.id}-${setsSignature}`}
                exercise={exercise}
                recentSets={recentSets}
                paused={paused}
                suggestionsAllowed={!discomfort && !deload}
                onChanged={state.reload}
              />

              {group.length > 1 && next && !paused ? (
                <Button
                  label={t('Дальше: {0}', { 0: exerciseName(next.exerciseId) })}
                  onPress={() => router.replace(`/workout/${next.id}`)}
                />
              ) : null}

              {paused ? null : <RestTimer recommendedSeconds={restSeconds} />}

              {error ? (
                <AppText accessibilityLiveRegion="polite" tone="danger">
                  {error}
                </AppText>
              ) : null}

              <Button
                label={t('Как выполнять')}
                variant="secondary"
                onPress={() => router.push(`/exercises/${exercise.exerciseId}`)}
              />
              <Button label={t('Боль или дискомфорт')} variant="secondary" onPress={reportDiscomfort} />
              {exercise.sets.length === 0 && !paused ? (
                <Button label={t('Убрать из тренировки')} variant="secondary" onPress={removeFromWorkout} />
              ) : null}
              <Button label={t('К обзору тренировки')} variant="secondary" onPress={() => router.back()} />
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
