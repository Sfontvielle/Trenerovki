import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { getNextDay, getProgram } from '@/domains/program/program-repository';
import { getSummary } from '@/domains/progress/progress-repository';
import { OpenSessionBanner } from '@/features/workout/open-session-banner';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { pluralize } from '@/lib/format';

export default function HomeScreen() {
  const { database, engine } = useAppData();
  const { start, starting, error } = useStartWorkout();

  const load = useCallback(async () => {
    const [openSession, program, summary] = await Promise.all([
      engine.getOpenSession(),
      getProgram(database),
      getSummary(database, new Date()),
    ]);
    return { openSession, nextDay: await getNextDay(database, program), summary };
  }, [database, engine]);
  const state = useScreenData(load);

  return (
    <TabScreen title="Главная">
      <DataView state={state}>
        {({ openSession, nextDay, summary }) => (
          <>
            {openSession ? <OpenSessionBanner session={openSession} /> : null}

            {!openSession && nextDay ? (
              <Panel>
                <AppText variant="callout" tone="secondary">
                  Следующая тренировка
                </AppText>
                <AppText variant="title">{nextDay.name}</AppText>
                {nextDay.exercises.map((exercise) => (
                  <AppText key={exercise.id} variant="callout" tone="secondary">
                    {exerciseName(exercise.exerciseId)}
                  </AppText>
                ))}
                {error ? (
                  <AppText accessibilityLiveRegion="polite" tone="danger">
                    {error}
                  </AppText>
                ) : null}
                <Button
                  label="Начать тренировку"
                  loading={starting}
                  onPress={() => start(nextDay.name, nextDay)}
                />
              </Panel>
            ) : null}

            <Panel>
              <AppText variant="heading">За последние 7 дней</AppText>
              <AppText tone="secondary">
                {`${summary.workoutsLastWeek} ${pluralize(summary.workoutsLastWeek, ['тренировка', 'тренировки', 'тренировок'])}`}
              </AppText>
            </Panel>

            <AppText variant="caption" tone="secondary">
              Шаги и сон пока не отслеживаются, а раздел питания в разработке.
            </AppText>
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
