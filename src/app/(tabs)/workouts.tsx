import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { getProgram } from '@/domains/program/program-repository';
import { OpenSessionBanner } from '@/features/workout/open-session-banner';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { formatRepRange } from '@/lib/format';

export default function WorkoutsScreen() {
  const { database, engine } = useAppData();
  const { start, starting, error } = useStartWorkout();

  const load = useCallback(async () => {
    const [openSession, program] = await Promise.all([engine.getOpenSession(), getProgram(database)]);
    return { openSession, program };
  }, [database, engine]);
  const state = useScreenData(load);

  return (
    <TabScreen title="Тренировки">
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
                    {`${exerciseName(exercise.exerciseId)}: ${exercise.targetSets} × ${formatRepRange(exercise.repsMin, exercise.repsMax)}`}
                  </AppText>
                ))}
                {openSession ? null : (
                  <Button
                    label={`Начать: ${day.name}`}
                    variant="secondary"
                    disabled={starting}
                    onPress={() => start(day.name, day)}
                  />
                )}
              </Panel>
            ))}

            {openSession ? null : (
              <Button
                label="Свободная тренировка"
                variant="secondary"
                disabled={starting}
                onPress={() => start('Свободная тренировка', null)}
              />
            )}
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
