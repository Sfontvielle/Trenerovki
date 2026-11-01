import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, ListGroup, ListRow, Panel, Screen, useTheme } from '@/design-system';
import { getDeloadUntil, isDeloadActive } from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import { dayKey } from '@/domains/nutrition/nutrition';
import { exerciseName } from '@/domains/exercises/catalog';
import { RestBar } from '@/features/workout/rest-bar';
import { restAfterSet, restSecondsFor } from '@/features/workout/rest-store';
import { RestTimer } from '@/features/workout/rest-timer';
import { describeTarget, groupLabel } from '@/features/workout/set-labels';
import { SetLogger } from '@/features/workout/set-logger';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { returnToTabs } from '@/lib/navigation';
import { t } from '@/lib/i18n';

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

  const act = async (action: () => Promise<void>, failure: string) => {
    setError(null);
    try {
      await action();
    } catch (cause) {
      console.error(cause);
      setError(`${failure} ${describeFailure(cause)}`);
    }
  };

  const reportDiscomfort = async () => {
    const approved = await confirm({
      title: t('Остановите упражнение'),
      message:
        t('Если боль сильная, резкая или не проходит, прекратите тренировку и обратитесь к врачу. При боли в груди, сильной одышке, головокружении или слабости сразу обратитесь за неотложной помощью. IRONVANT не ставит диагнозы. Отметить дискомфорт? Мы не будем предлагать прибавку веса в этом упражнении 14 дней.'),
      confirmLabel: t('Отметить'),
    });
    if (approved) {
      await act(async () => {
        await engine.reportDiscomfort(sessionExerciseId, createId());
        state.reload();
      }, t('Отметка не сохранена.'));
    }
  };

  const removeFromWorkout = () =>
    act(async () => {
      await engine.removeExercise(sessionExerciseId, createId());
      router.back();
    }, t('Упражнение не убрано.'));

  const changeGroup = (action: () => Promise<unknown>) =>
    act(async () => {
      await action();
      state.reload();
    }, t('Группа не изменена.'));

  return (
    <Screen scroll belowHeader footer={<RestBar />}>
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
          const nextInGroup = group[(group.findIndex(({ id }) => id === exercise.id) + 1) % Math.max(group.length, 1)];
          const following = session.exercises[session.exercises.findIndex(({ id }) => id === exercise.id) + 1];
          const linkedToNext = Boolean(following && exercise.groupId && following.groupId === exercise.groupId);
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
                onLogged={(kind) => restAfterSet(exercise, session.exercises, kind)}
              />

              {group.length > 1 && nextInGroup && !paused ? (
                <Button
                  label={t('Дальше: {0}', { 0: exerciseName(nextInGroup.exerciseId) })}
                  onPress={() => router.replace(`/workout/${nextInGroup.id}`)}
                />
              ) : null}

              {paused ? null : <RestTimer recommendedSeconds={restSecondsFor(exercise)} />}

              {error ? (
                <AppText accessibilityLiveRegion="polite" tone="danger">
                  {error}
                </AppText>
              ) : null}

              <ListGroup>
                <ListRow
                  icon={{ name: 'book', glyph: '≡' }}
                  onPress={() => router.push(`/exercises/${exercise.exerciseId}`)}
                  title={t('Как выполнять')}
                />
                {!paused && linkedToNext ? (
                  <ListRow
                    icon={{ name: 'link', glyph: '∞' }}
                    onPress={() => changeGroup(() => engine.unlinkExercise(exercise.id, createId()))}
                    title={t('Разъединить')}
                  />
                ) : null}
                {!paused && following && !linkedToNext ? (
                  <ListRow
                    icon={{ name: 'link', glyph: '∞' }}
                    onPress={() => changeGroup(() => engine.linkWithNext(exercise.id, createId()))}
                    subtitle={exerciseName(following.exerciseId)}
                    title={t('Объединить со следующим')}
                  />
                ) : null}
                <ListRow
                  icon={{ name: 'exclamationmark.triangle', glyph: '!', color: theme.colors.warning }}
                  onPress={reportDiscomfort}
                  title={t('Боль или дискомфорт')}
                />
                {exercise.sets.length === 0 && !paused ? (
                  <ListRow
                    icon={{ name: 'minus.circle', glyph: '−', color: theme.colors.danger }}
                    onPress={removeFromWorkout}
                    title={t('Убрать из тренировки')}
                    tone="danger"
                  />
                ) : null}
              </ListGroup>
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
