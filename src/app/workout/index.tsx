import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, IconButton, Panel, Screen, useTheme } from '@/design-system';
import { getDeloadUntil, isDeloadActive } from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import { dayKey } from '@/domains/nutrition/nutrition';
import { formatDuration, sessionDurationMs } from '@/domains/workout/session-time';
import type { WorkoutSession, WorkoutSet } from '@/domains/workout/types';
import { RestBar } from '@/features/workout/rest-bar';
import { restTimer } from '@/features/workout/rest-store';
import { ExerciseBlock } from '@/features/workout/set-table';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { pluralize } from '@/lib/format';
import { returnToTabs } from '@/lib/navigation';
import { t } from '@/lib/i18n';

const HISTORY_DEPTH = 2;

function SessionClock({ session }: { session: WorkoutSession }) {
  const paused = session.state === 'paused';
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (paused) {
      return;
    }
    const tick = () => setNow(new Date());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [paused]);

  return (
    <AppText variant="scoreLarge" tone={paused ? 'warning' : 'accent'}>
      {formatDuration(sessionDurationMs(session, now))}
    </AppText>
  );
}

type ExerciseHistory = {
  recentSets: WorkoutSet[][];
  discomfort: boolean;
};

type SessionOverviewProps = {
  session: WorkoutSession;
  history: Record<string, ExerciseHistory>;
  deload: boolean;
  onChanged: () => void;
};

function useSessionActions({ session, onChanged }: Pick<SessionOverviewProps, 'session' | 'onChanged'>) {
  const { engine } = useAppData();
  const paused = session.state === 'paused';
  const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        restTimer.stop();
        router.replace({ pathname: '/history/[sessionId]', params: { sessionId: session.id, finished: '1' } });
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
        restTimer.stop();
        returnToTabs();
      });
    }
  };

  return { busy, error, paused, setCount, togglePause, finish, cancel };
}

export default function WorkoutScreen() {
  const { database, engine } = useAppData();
  const load = useCallback(async () => {
    const session = await engine.getOpenSession();
    if (!session) {
      return null;
    }
    const [deloadUntil, entries] = await Promise.all([
      getDeloadUntil(database),
      Promise.all(
        session.exercises.map(async (exercise) => {
          const [recentSets, discomfort] = await Promise.all([
            engine.getRecentPerformances(exercise.exerciseId, HISTORY_DEPTH, session.id),
            engine.hasRecentDiscomfort(exercise.exerciseId),
          ]);
          return [exercise.id, { recentSets, discomfort }] as const;
        }),
      ),
    ]);
    return {
      session,
      history: Object.fromEntries(entries),
      deload: isDeloadActive(deloadUntil, dayKey(new Date())),
    };
  }, [database, engine]);
  const state = useScreenData(load);
  const session = state.status === 'ready' ? (state.data?.session ?? null) : null;

  return session && state.status === 'ready' && state.data ? (
    <OpenSession
      session={session}
      history={state.data.history}
      deload={state.data.deload}
      onChanged={state.reload}
    />
  ) : (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {() => (
          <Panel>
            <AppText variant="heading">{t('Нет открытой тренировки')}</AppText>
            <AppText tone="secondary">{t('Начните тренировку на вкладке «Тренировки».')}</AppText>
            <Button label={t('Открыть главную')} variant="secondary" onPress={returnToTabs} />
          </Panel>
        )}
      </DataView>
    </Screen>
  );
}

function OpenSession({ session, history, deload, onChanged }: SessionOverviewProps) {
  const { theme } = useTheme();
  const { busy, error, paused, setCount, togglePause, finish, cancel } = useSessionActions({ session, onChanged });
  const plannedSetsDone = session.exercises.every(({ plannedSets, sets }) => sets.length >= (plannedSets ?? 1));

  return (
    <Screen
      scroll
      belowHeader
      footer={
        <>
          <RestBar />
          <Button
            label={t('Завершить тренировку')}
            variant={plannedSetsDone ? 'primary' : 'secondary'}
            disabled={setCount === 0}
            loading={busy}
            onPress={finish}
          />
        </>
      }
    >
      <View style={[styles.header, { gap: theme.spacing.m }]}>
        <View style={styles.headerText}>
          <AppText accessibilityRole="header" variant="heading">
            {session.title}
          </AppText>
          <SessionClock session={session} />
        </View>
        {paused ? null : (
          <IconButton disabled={busy} glyph="Ⅱ" label={t('Пауза')} name="pause.fill" onPress={togglePause} />
        )}
      </View>

      {paused ? (
        <Panel>
          {session.recoveryRequired ? (
            <>
              <AppText variant="heading">{t('Тренировка была прервана')}</AppText>
              <AppText tone="secondary">
                {t('Все записанные подходы сохранены. Время после последнего действия не считается. Проверьте их и выберите: продолжить, завершить или отменить тренировку.')}
              </AppText>
            </>
          ) : (
            <AppText tone="secondary">{t('Тренировка на паузе. Продолжите её, чтобы записывать подходы.')}</AppText>
          )}
          <Button label={t('Продолжить')} disabled={busy} onPress={togglePause} />
        </Panel>
      ) : null}

      {session.exercises.length === 0 ? (
        <AppText tone="secondary">{t('Добавьте первое упражнение, чтобы начать записывать подходы.')}</AppText>
      ) : null}

      {session.exercises.map((exercise) => {
        const details = history[exercise.id];
        return (
          <ExerciseBlock
            key={exercise.id}
            exercise={exercise}
            exercises={session.exercises}
            onChanged={onChanged}
            paused={paused}
            recentSets={details?.recentSets ?? []}
            suggestionsAllowed={!deload && !details?.discomfort}
          />
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

      {setCount === 0 ? (
        <AppText variant="caption" tone="secondary">
          {t('Завершить можно после первого записанного подхода.')}
        </AppText>
      ) : null}
      <Button label={t('Отменить тренировку')} variant="danger" disabled={busy} onPress={cancel} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerText: {
    flex: 1,
  },
});
