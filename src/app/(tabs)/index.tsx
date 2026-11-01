import { router } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { Gauge } from '@/components/gauge';
import { MuscleMap } from '@/components/muscle-map';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { WeekStrip } from '@/components/week-strip';
import { AppText, Button, ListGroup, ListRow, Panel, useTheme } from '@/design-system';
import { listBodyWeight } from '@/domains/body/body-weight-repository';
import { getDeloadUntil, isDeloadActive } from '@/domains/coach/coach-repository';
import { type Muscle, muscleLabels } from '@/domains/exercises/catalog';
import { dayKey, sumNutrients } from '@/domains/nutrition/nutrition';
import { getManualTarget, listDayEntries } from '@/domains/nutrition/nutrition-repository';
import { dayTarget } from '@/domains/nutrition/targets';
import { getNextDay, getProgram } from '@/domains/program/program-repository';
import { scheduleHeading } from '@/domains/program/schedule';
import { average } from '@/domains/progress/analytics';
import { estimateMuscleLoad, listRecentWork } from '@/domains/progress/muscle-recovery';
import { finishedWorkoutToday, listCompletedSessions } from '@/domains/progress/progress-repository';
import { assessReadiness } from '@/domains/recovery/recovery';
import { countRecentWorkouts, getCheckin, listSteps } from '@/domains/recovery/recovery-repository';
import { RecoveryCard, StepsNote } from '@/features/recovery/recovery-cards';
import { useSteps } from '@/features/recovery/use-steps';
import { describeDay } from '@/features/workout/describe-day';
import { OpenSessionBanner } from '@/features/workout/open-session-banner';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { formatNumber, formatWeight } from '@/lib/format';
import { t } from '@/lib/i18n';

const MUSCLE_MAP_HEIGHT = 170;
const STEP_HISTORY_DAYS = 14;
const STRAINED_LEVEL = 0.3;

export default function HomeScreen() {
  const { database, engine, profile } = useAppData();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const { start, starting, error } = useStartWorkout();
  const trainingDays = profile?.trainingDays;
  const steps = useSteps();

  const load = useCallback(async () => {
    const now = new Date();
    const today = dayKey(now);
    const [openSession, program, sessions, foodEntries, bodyWeight, doneToday, checkin, recent, deloadUntil, manual, stepHistory, work] =
      await Promise.all([
        engine.getOpenSession(),
        getProgram(database),
        listCompletedSessions(database),
        listDayEntries(database, today),
        listBodyWeight(database, 1),
        finishedWorkoutToday(database, now),
        getCheckin(database, today),
        countRecentWorkouts(database, now),
        getDeloadUntil(database),
        getManualTarget(database),
        listSteps(database, STEP_HISTORY_DAYS),
        listRecentWork(database, now),
      ]);
    return {
      now,
      heading: doneToday ? t('Следующая тренировка') : scheduleHeading(trainingDays ?? [], now),
      openSession,
      nextDay: await getNextDay(database, program),
      trainedDays: sessions.map(({ finishedAt }) => dayKey(new Date(finishedAt))),
      eaten: sumNutrients(foodEntries),
      target: dayTarget(profile, manual),
      latestWeight: bodyWeight.at(-1) ?? null,
      checkin,
      readiness: assessReadiness(checkin, recent),
      deload: isDeloadActive(deloadUntil, today),
      usualSteps: average(stepHistory.filter(({ day }) => day !== today).map((day) => day.steps)),
      muscleLoad: estimateMuscleLoad(work, now),
    };
  }, [database, engine, profile, trainingDays]);
  const state = useScreenData(load);

  return (
    <TabScreen title={t('Главная')}>
      <DataView state={state}>
        {({ now, heading, openSession, nextDay, trainedDays, eaten, target, latestWeight, checkin, readiness, deload, usualSteps, muscleLoad }) => {
          const stepsToday = steps.state.status === 'ready' ? steps.state.today : null;
          const strained = (Object.keys(muscleLoad) as Muscle[]).filter(
            (muscle) => (muscleLoad[muscle] ?? 0) >= STRAINED_LEVEL,
          );

          return (
            <>
              {openSession ? <OpenSessionBanner session={openSession} /> : null}

              {!openSession && nextDay ? (
                <Panel>
                  <AppText variant="callout" tone="accent">
                    {heading}
                  </AppText>
                  <View>
                    <AppText variant="scoreLarge">{nextDay.name}</AppText>
                    <AppText variant="callout" tone="secondary">
                      {describeDay(nextDay)}
                    </AppText>
                  </View>
                  {deload ? (
                    <AppText variant="callout" tone="accent">
                      {t('Лёгкая неделя: на один подход меньше в упражнениях, где их два и больше. Вес не прибавляйте.')}
                    </AppText>
                  ) : null}
                  {error ? (
                    <AppText accessibilityLiveRegion="polite" tone="danger">
                      {error}
                    </AppText>
                  ) : null}
                  <Button
                    label={t('Начать тренировку')}
                    loading={starting}
                    onPress={() => start(nextDay.name, nextDay)}
                  />
                </Panel>
              ) : null}

              <View style={{ gap: spacing.s }}>
                <View style={{ flexDirection: 'row' }}>
                  <Gauge
                    label={t('Шаги')}
                    onPress={() => router.push('/analytics')}
                    ratio={stepsToday !== null && usualSteps ? stepsToday / usualSteps : null}
                    value={stepsToday === null ? '—' : formatNumber(stepsToday)}
                  />
                  <Gauge
                    label={t('Калории')}
                    onPress={() => router.navigate('/nutrition')}
                    ratio={target && profile?.nutritionMode === 'targets' ? eaten.kcal / target.kcal : null}
                    unit={t('ккал')}
                    value={formatNumber(Math.round(eaten.kcal))}
                  />
                  <Gauge
                    label={t('Белок')}
                    onPress={() => router.navigate('/nutrition')}
                    ratio={target ? eaten.protein / target.protein : null}
                    unit={t('г')}
                    value={formatNumber(Math.round(eaten.protein))}
                  />
                </View>
                <StepsNote state={steps.state} onRequestAccess={steps.requestAccess} />
              </View>

              <ListGroup title={t('Эта неделя')}>
                <View style={{ padding: spacing.m }}>
                  <WeekStrip now={now} plannedWeekdays={trainingDays ?? []} trainedDays={trainedDays} />
                </View>
              </ListGroup>

              <RecoveryCard checkin={checkin} readiness={readiness} />

              {strained.length > 0 ? (
                <ListGroup
                  title={t('Недавняя нагрузка')}
                  footer={t('Примерная картина: что вы тренировали за последние три дня. Это не оценка состояния мышц.')}
                >
                  <View style={{ padding: spacing.m }}>
                    <MuscleMap
                      height={MUSCLE_MAP_HEIGHT}
                      levels={muscleLoad}
                      summary={t('Недавно нагружены: {0}', {
                        0: strained.map((muscle) => muscleLabels[muscle].toLowerCase()).join(', '),
                      })}
                    />
                  </View>
                </ListGroup>
              ) : null}

              <ListGroup>
                <ListRow
                  accessibilityLabel={t('Вес тела')}
                  icon={{ name: 'scalemass', glyph: '⚖', color: colors.accent }}
                  onPress={() => router.push('/body-weight')}
                  title={t('Вес тела')}
                  value={
                    latestWeight
                      ? formatWeight(latestWeight.weightKg)
                      : profile?.weightKg
                        ? t('{0}, из анкеты', { 0: formatWeight(profile.weightKg) })
                        : t('Пока не записан')
                  }
                />
              </ListGroup>
            </>
          );
        }}
      </DataView>
    </TabScreen>
  );
}
