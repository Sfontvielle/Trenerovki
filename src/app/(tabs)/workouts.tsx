import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { getProgram } from '@/domains/program/program-repository';
import { OpenSessionBanner } from '@/features/workout/open-session-banner';
import { describeTarget } from '@/features/workout/set-labels';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { t } from '@/lib/i18n';

export default function WorkoutsScreen() {
  const { database, engine } = useAppData();
  const { start, starting, error } = useStartWorkout();

  const load = useCallback(async () => {
    const [openSession, program] = await Promise.all([engine.getOpenSession(), getProgram(database)]);
    return { openSession, program };
  }, [database, engine]);
  const state = useScreenData(load);

  return (
    <TabScreen title={t('Тренировки')}>
      <DataView state={state}>
        {({ openSession, program }) => (
          <>
            {openSession ? <OpenSessionBanner session={openSession} /> : null}

            {error ? (
              <AppText accessibilityLiveRegion="polite" tone="danger">
                {error}
              </AppText>
            ) : null}

            {program.map((day) => (
              <Panel key={day.id}>
                <AppText variant="heading">{day.name}</AppText>
                {day.exercises.map((exercise) => (
                  <AppText key={exercise.id} variant="callout" tone="secondary">
                    {`${exerciseName(exercise.exerciseId)}: ${describeTarget({ sets: exercise.targetSets, repsMin: exercise.repsMin, repsMax: exercise.repsMax, durationSec: exercise.targetDurationSec })}`}
                  </AppText>
                ))}
                {openSession ? null : (
                  <Button
                    label={t('Начать: {0}', { 0: day.name })}
                    variant="secondary"
                    disabled={starting}
                    onPress={() => start(day.name, day)}
                  />
                )}
                <Button
                  accessibilityLabel={t('Изменить упражнения: {0}', { 0: day.name })}
                  label={t('Изменить упражнения')}
                  variant="secondary"
                  onPress={() => router.push(`/plan/${day.id}`)}
                />
              </Panel>
            ))}

            <Button
              label={t('Библиотека упражнений')}
              variant="secondary"
              onPress={() => router.push('/exercises')}
            />

            {openSession ? null : (
              <Button
                label={t('Свободная тренировка')}
                variant="secondary"
                disabled={starting}
                onPress={() => start(t('Свободная тренировка'), null)}
              />
            )}
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
