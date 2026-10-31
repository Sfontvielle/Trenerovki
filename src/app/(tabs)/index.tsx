import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { listBodyWeight } from '@/domains/body/body-weight-repository';
import { getDeloadUntil, isDeloadActive } from '@/domains/coach/coach-repository';
import { dayKey, sumNutrients } from '@/domains/nutrition/nutrition';
import { listDayEntries } from '@/domains/nutrition/nutrition-repository';
import { getNextDay, getProgram } from '@/domains/program/program-repository';
import { scheduleHeading } from '@/domains/program/schedule';
import { finishedWorkoutToday, getSummary } from '@/domains/progress/progress-repository';
import { assessReadiness } from '@/domains/recovery/recovery';
import { countRecentWorkouts, getCheckin } from '@/domains/recovery/recovery-repository';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { RecoveryCard, StepsCard } from '@/features/recovery/recovery-cards';
import { useSteps } from '@/features/recovery/use-steps';
import { OpenSessionBanner } from '@/features/workout/open-session-banner';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { formatWeight, pluralize } from '@/lib/format';

export default function HomeScreen() {
  const { database, engine, profile } = useAppData();
  const { start, starting, error } = useStartWorkout();
  const trainingDays = profile?.trainingDays;
  const steps = useSteps();

  const load = useCallback(async () => {
    const now = new Date();
    const today = dayKey(now);
    const [openSession, program, summary, foodEntries, bodyWeight, doneToday, checkin, recent, deloadUntil] = await Promise.all([
      engine.getOpenSession(),
      getProgram(database),
      getSummary(database, now),
      listDayEntries(database, today),
      listBodyWeight(database, 1),
      finishedWorkoutToday(database, now),
      getCheckin(database, today),
      countRecentWorkouts(database, now),
      getDeloadUntil(database),
    ]);
    return {
      heading: doneToday ? 'Следующая тренировка' : scheduleHeading(trainingDays ?? [], now),
      openSession,
      nextDay: await getNextDay(database, program),
      summary,
      foodEntries,
      latestWeight: bodyWeight.at(-1) ?? null,
      checkin,
      readiness: assessReadiness(checkin, recent),
      deload: isDeloadActive(deloadUntil, today),
    };
  }, [database, engine, trainingDays]);
  const state = useScreenData(load);

  return (
    <TabScreen title="Главная">
      <DataView state={state}>
        {({ heading, openSession, nextDay, summary, foodEntries, latestWeight, checkin, readiness, deload }) => (
          <>
            {openSession ? <OpenSessionBanner session={openSession} /> : null}

            {!openSession && nextDay ? (
              <Panel>
                <AppText variant="callout" tone="secondary">
                  {heading}
                </AppText>
                <AppText variant="title">{nextDay.name}</AppText>
                {deload ? (
                  <AppText variant="callout" tone="accent">
                    Лёгкая неделя: на один подход меньше в каждом упражнении
                  </AppText>
                ) : null}
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

            <StepsCard state={steps.state} onRequestAccess={steps.requestAccess} />

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

            <RecoveryCard checkin={checkin} readiness={readiness} />

            <Panel>
              <AppText variant="heading">Вес тела</AppText>
              <AppText tone="secondary">
                {latestWeight ? formatWeight(latestWeight.weightKg) : 'Пока не записан'}
              </AppText>
              <Button label="Записать вес" variant="secondary" onPress={() => router.push('/body-weight')} />
            </Panel>

          </>
        )}
      </DataView>
    </TabScreen>
  );
}
