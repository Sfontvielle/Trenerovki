import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName } from '@/domains/exercises/catalog';
import { formatDuration, sessionDurationMs } from '@/domains/workout/session-time';
import type { SessionExercise, WorkoutSession } from '@/domains/workout/types';
import { describeTarget, groupLabel } from '@/features/workout/set-labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { pluralize } from '@/lib/format';
import { returnToTabs } from '@/lib/navigation';
import { t } from '@/lib/i18n';

function useNow(running: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!running) {
      return;
    }
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [running]);

  return now;
}

function describeProgress(exercise: SessionExercise) {
  const done = exercise.sets.length;
  const target = describeTarget({
    sets: null,
    repsMin: exercise.repsMin,
    repsMax: exercise.repsMax,
    durationSec: exercise.targetDurationSec,
  });
  const planned = exercise.plannedSets === null ? `${done}` : t('{0} из {1}', { 0: done, 1: exercise.plannedSets });
  return target ? t('Подходы: {0}, цель {1}', { 0: planned, 1: target }) : t('Подходы: {0}', { 0: planned });
}

type SessionOverviewProps = {
  session: WorkoutSession;
  onChanged: () => void;
};

function SessionOverview({ session, onChanged }: SessionOverviewProps) {
  const { engine } = useAppData();
  const { theme } = useTheme();
  const paused = session.state === 'paused';
  const now = useNow(!paused);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      console.error(cause);
      setError(t('Действие не выполнено. Записанные подходы сохранены. {0}', { 0: describeFailure(cause) }));
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const togglePause = () =>
    run(async () => {
      await (paused
        ? engine.resumeSession(session.id, createId())
        : engine.pauseSession(session.id, createId()));
      onChanged();
    });

  const finish = async () => {
    const approved = await confirm({
      title: t('Завершить тренировку?'),
      message: t('Записано {0} {1}. После завершения их можно будет исправить только в истории.', { 0: setCount, 1: pluralize(setCount, [t('подход'), t('подхода'), t('подходов')]) }),
      confirmLabel: t('Завершить'),
    });
    if (approved) {
      await run(async () => {
        await engine.completeSession(session.id, createId());
        router.replace(`/history/${session.id}`);
      });
    }
  };

  const cancel = async () => {
    const lost =
      setCount > 0
        ? t('Записанные подходы ({0}) не попадут в историю и прогресс. Вернуть их нельзя.', { 0: setCount })
        : t('Она не попадёт в историю и прогресс.');
    const approved = await confirm({
      title: t('Отменить тренировку?'),
      message: lost,
      confirmLabel: t('Отменить тренировку'),
      destructive: true,
    });
    if (approved) {
      await run(async () => {
        await engine.cancelSession(session.id, createId());
        returnToTabs();
      });
    }
  };

  return (
    <>
      <View style={{ gap: theme.spacing.xs }}>
        <AppText accessibilityRole="header" variant="title">
          {session.title}
        </AppText>
        <AppText variant="heading" tone={paused ? 'warning' : 'accent'}>
          {`${formatDuration(sessionDurationMs(session, now))}${paused ? t(', пауза') : ''}`}
        </AppText>
      </View>

      {session.recoveryRequired ? (
        <Panel>
          <AppText variant="heading">{t('Тренировка была прервана')}</AppText>
          <AppText tone="secondary">
            {t('Все записанные подходы сохранены. Время после последнего действия не считается. Проверьте их и выберите: продолжить, завершить или отменить тренировку.')}
          </AppText>
        </Panel>
      ) : null}

      {session.exercises.length === 0 ? (
        <AppText tone="secondary">{t('Добавьте первое упражнение, чтобы начать записывать подходы.')}</AppText>
      ) : null}

      {session.exercises.map((exercise, index) => {
        const name = exerciseName(exercise.exerciseId);
        const next = session.exercises[index + 1];
        const groupSize = session.exercises.filter(({ groupId }) => groupId && groupId === exercise.groupId).length;
        const linkedToNext = Boolean(next && exercise.groupId && next.groupId === exercise.groupId);
        return (
          <View key={exercise.id} style={{ gap: theme.spacing.s }}>
            <Pressable accessibilityRole="button" onPress={() => router.push(`/workout/${exercise.id}`)}>
              <Panel>
                <AppText variant="heading">{name}</AppText>
                <AppText variant="callout" tone="secondary">
                  {describeProgress(exercise)}
                </AppText>
                {groupSize > 1 ? (
                  <AppText variant="caption" tone="accent">
                    {groupLabel(groupSize)}
                  </AppText>
                ) : null}
              </Panel>
            </Pressable>
            {paused ? null : linkedToNext ? (
              <Button
                accessibilityLabel={t('Разъединить: {0}', { 0: name })}
                label={t('Разъединить')}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await engine.unlinkExercise(exercise.id, createId());
                    onChanged();
                  })
                }
              />
            ) : next ? (
              <Button
                accessibilityLabel={t('Объединить со следующим: {0}', { 0: name })}
                label={t('Объединить со следующим')}
                variant="secondary"
                disabled={busy}
                onPress={() =>
                  run(async () => {
                    await engine.linkWithNext(exercise.id, createId());
                    onChanged();
                  })
                }
              />
            ) : null}
          </View>
        );
      })}

      <Button
        label={t('Добавить упражнение')}
        variant="secondary"
        disabled={paused || busy}
        onPress={() => router.push('/workout/add')}
      />

      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}

      <Button
        label={paused ? t('Продолжить') : t('Пауза')}
        variant="secondary"
        disabled={busy}
        onPress={togglePause}
      />
      <Button label={t('Завершить тренировку')} disabled={setCount === 0} loading={busy} onPress={finish} />
      {setCount === 0 ? (
        <AppText variant="caption" tone="secondary">
          {t('Завершить можно после первого записанного подхода.')}
        </AppText>
      ) : null}
      <Button label={t('Отменить тренировку')} variant="secondary" disabled={busy} onPress={cancel} />
    </>
  );
}

export default function WorkoutScreen() {
  const { engine } = useAppData();
  const load = useCallback(() => engine.getOpenSession(), [engine]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(session) =>
          session ? (
            <SessionOverview session={session} onChanged={state.reload} />
          ) : (
            <Panel>
              <AppText variant="heading">{t('Нет открытой тренировки')}</AppText>
              <AppText tone="secondary">{t('Начните тренировку на вкладке «Тренировки».')}</AppText>
              <Button label={t('Открыть главную')} variant="secondary" onPress={returnToTabs} />
            </Panel>
          )
        }
      </DataView>
    </Screen>
  );
}
