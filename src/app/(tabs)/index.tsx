import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { dayKey, sumNutrients } from '@/domains/nutrition/nutrition';
import { listDayEntries } from '@/domains/nutrition/nutrition-repository';
import { getNextDay, getProgram } from '@/domains/program/program-repository';
import { getSummary } from '@/domains/progress/progress-repository';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { OpenSessionBanner } from '@/features/workout/open-session-banner';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { pluralize } from '@/lib/format';

export default function HomeScreen() {
  const { database, engine } = useAppData();
  const { start, starting, error } = useStartWorkout();

  const load = useCallback(async () => {
    const [openSession, program, summary, foodEntries] = await Promise.all([
      engine.getOpenSession(),
      getProgram(database),
      getSummary(database, new Date()),
      listDayEntries(database, dayKey(new Date())),
    ]);
    return { openSession, nextDay: await getNextDay(database, program), summary, foodEntries };
  }, [database, engine]);
  const state = useScreenData(load);

  return (
    <TabScreen title="Главная">
      <DataView state={state}>
        {({ openSession, nextDay, summary, foodEntries }) => (
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

            <Panel>
              <AppText variant="heading">Питание сегодня</AppText>
              {foodEntries.length > 0 ? (
                <>
                  <AppText tone="secondary">{formatEnergy(sumNutrients(foodEntries).kcal)}</AppText>
                  <AppText variant="callout" tone="secondary">
                    {formatMacros(sumNutrients(foodEntries))}
                  </AppText>
                </>
              ) : (
                <AppText tone="secondary">Пока ничего не записано</AppText>
              )}
            </Panel>

            <AppText variant="caption" tone="secondary">
              Шаги и сон пока не отслеживаются.
            </AppText>
          </>
        )}
      </DataView>
    </TabScreen>
  );
}
