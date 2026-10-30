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
import { confirm } from '@/lib/confirm';
import { formatRepRange } from '@/lib/format';

function useNow(running: boolean) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  return now;
}

function describeProgress(exercise: SessionExercise) {
  const done = exercise.sets.length;
  const reps = formatRepRange(exercise.repsMin, exercise.repsMax);
  const planned = exercise.plannedSets === null ? `${done}` : `${done} из ${exercise.plannedSets}`;
  return reps ? `Подходы: ${planned}, цель ${reps}` : `Подходы: ${planned}`;
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
  const [failed, setFailed] = useState(false);
  const setCount = session.exercises.reduce((total, exercise) => total + exercise.sets.length, 0);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setFailed(false);
    try {
      await action();
    } catch (error) {
      console.error(error);
      setFailed(true);
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

  const finish = () =>
    run(async () => {
      await engine.completeSession(session.id, createId());
      router.replace(`/history/${session.id}`);
    });

  const cancel = async () => {
    const approved = await confirm({
      title: 'Отменить тренировку?',
      message: 'Она не попадёт в историю и прогресс.',
      confirmLabel: 'Отменить тренировку',
      destructive: true,
    });
    if (approved) {
      await run(async () => {
        await engine.cancelSession(session.id, createId());
        router.replace('/');
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
          {`${formatDuration(sessionDurationMs(session, now))}${paused ? ', пауза' : ''}`}
        </AppText>
      </View>

      {session.exercises.length === 0 ? (
        <AppText tone="secondary">Добавьте первое упражнение, чтобы начать записывать подходы.</AppText>
      ) : null}

      {session.exercises.map((exercise) => (
        <Pressable
          key={exercise.id}
          accessibilityRole="button"
          onPress={() => router.push(`/workout/${exercise.id}`)}
        >
          <Panel>
            <AppText variant="heading">{exerciseName(exercise.exerciseId)}</AppText>
            <AppText variant="callout" tone="secondary">
              {describeProgress(exercise)}
            </AppText>
          </Panel>
        </Pressable>
      ))}

      <Button
        label="Добавить упражнение"
        variant="secondary"
        disabled={paused || busy}
        onPress={() => router.push('/workout/add')}
      />

      {failed ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          Действие не выполнено. Записанные подходы сохранены, попробуйте ещё раз.
        </AppText>
      ) : null}

      <Button
        label={paused ? 'Продолжить' : 'Пауза'}
        variant="secondary"
        disabled={busy}
        onPress={togglePause}
      />
      <Button label="Завершить тренировку" disabled={setCount === 0} loading={busy} onPress={finish} />
      {setCount === 0 ? (
        <AppText variant="caption" tone="secondary">
          Завершить можно после первого записанного подхода.
        </AppText>
      ) : null}
      <Button label="Отменить тренировку" variant="secondary" disabled={busy} onPress={cancel} />
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
              <AppText variant="heading">Нет открытой тренировки</AppText>
              <AppText tone="secondary">Начните тренировку на вкладке «Тренировки».</AppText>
              <Button label="Открыть главную" variant="secondary" onPress={() => router.replace('/')} />
            </Panel>
          )
        }
      </DataView>
    </Screen>
  );
}
