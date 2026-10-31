import { useCallback } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { ProgressLine } from '@/components/progress-line';
import { DataView } from '@/components/states';
import { TrendBars } from '@/components/trend-bars';
import { AppText, Panel, Screen, useTheme } from '@/design-system';
import { listBodyWeight } from '@/domains/body/body-weight-repository';
import { muscleGroupLabels } from '@/domains/exercises/catalog';
import { dayKey, shiftDay } from '@/domains/nutrition/nutrition';
import { getManualTarget, listDailyTotals } from '@/domains/nutrition/nutrition-repository';
import { estimateTargets } from '@/domains/nutrition/targets';
import { average, getCardioTotals, listSetsByGroup, listWeeks, weeksInARow } from '@/domains/progress/analytics';
import { listCheckins, listSteps } from '@/domains/recovery/recovery-repository';
import { formatEnergy } from '@/features/nutrition/format-nutrition';
import { formatSeconds } from '@/features/workout/set-labels';
import { formatDate, formatNumber, pluralize } from '@/lib/format';

const WEEKS_SHOWN = 8;
const GROUP_WINDOW_MS = 28 * 24 * 60 * 60 * 1000;
const DAYS_SHOWN = 14;
const METERS_IN_KM = 1000;

function dayLabel(day: string, value: string) {
  return `${formatDate(`${day}T12:00:00`)}: ${value}`;
}

function NoData({ text }: { text: string }) {
  return <AppText tone="secondary">{text}</AppText>;
}

export default function AnalyticsScreen() {
  const { database, profile } = useAppData();
  const { theme } = useTheme();

  const load = useCallback(async () => {
    const now = new Date();
    const since = new Date(now.getTime() - GROUP_WINDOW_MS);
    const [weeks, groups, cardio, weight, food, manual, checkins, steps] = await Promise.all([
      listWeeks(database, now, WEEKS_SHOWN),
      listSetsByGroup(database, since),
      getCardioTotals(database, since),
      listBodyWeight(database, 30),
      listDailyTotals(database, shiftDay(dayKey(now), -DAYS_SHOWN)),
      getManualTarget(database),
      listCheckins(database, DAYS_SHOWN),
      listSteps(database, DAYS_SHOWN),
    ]);
    return {
      weeks,
      groups,
      cardio,
      weight,
      food,
      target: manual ?? (profile ? estimateTargets(profile) : null),
      sleep: checkins.filter((checkin) => checkin.sleepHours !== null),
      steps,
    };
  }, [database, profile]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {({ weeks, groups, cardio, weight, food, target, sleep, steps }) => {
          const streak = weeksInARow(weeks);
          const hasWorkouts = weeks.some(({ workouts }) => workouts > 0);
          const hasVolume = weeks.some(({ volumeKg }) => volumeKg > 0);
          const mostSets = groups[0]?.sets ?? 0;
          const weightChange = weight.length > 1 ? (weight.at(-1)?.weightKg ?? 0) - weight[0].weightKg : null;
          const averageKcal = average(food.map(({ kcal }) => kcal));
          const averageProtein = average(food.map(({ protein }) => protein));
          const averageSleep = average(sleep.map(({ sleepHours }) => sleepHours as number));
          const averageSteps = average(steps.map((day) => day.steps));

          return (
            <>
              <Panel>
                <AppText variant="heading">Тренировки по неделям</AppText>
                {hasWorkouts ? (
                  <>
                    <TrendBars
                      bars={weeks.map(({ weeksAgo, workouts }) => ({
                        key: String(weeksAgo),
                        value: workouts,
                        label: `${weeksAgo === 0 ? 'Последние 7 дней' : `${weeksAgo} нед. назад`}: ${workouts}`,
                      }))}
                    />
                    <AppText variant="callout" tone="secondary">
                      {`Недель подряд с тренировками: ${streak}`}
                    </AppText>
                  </>
                ) : (
                  <NoData text="Появится после первой завершённой тренировки." />
                )}
              </Panel>

              {hasVolume ? (
                <Panel>
                  <AppText variant="heading">Объём по неделям</AppText>
                  <TrendBars
                    bars={weeks.map(({ weeksAgo, volumeKg }) => ({
                      key: String(weeksAgo),
                      value: volumeKg,
                      label: `${weeksAgo === 0 ? 'Последние 7 дней' : `${weeksAgo} нед. назад`}: ${formatNumber(volumeKg)} кг`,
                    }))}
                  />
                  <AppText variant="caption" tone="secondary">
                    Сумма «вес × повторы» без разминочных подходов.
                  </AppText>
                </Panel>
              ) : null}

              {groups.length > 0 ? (
                <Panel>
                  <AppText variant="heading">Подходы по группам мышц за 4 недели</AppText>
                  {groups.map(({ group, sets }) => (
                    <View key={group} style={{ gap: theme.spacing.xs }}>
                      <AppText variant="callout" tone="secondary">
                        {`${muscleGroupLabels[group]}: ${sets}`}
                      </AppText>
                      <ProgressLine label={muscleGroupLabels[group]} ratio={sets / mostSets} />
                    </View>
                  ))}
                </Panel>
              ) : null}

              {cardio.meters > 0 ? (
                <Panel>
                  <AppText variant="heading">Кардио за 4 недели</AppText>
                  <AppText tone="secondary">
                    {`${formatNumber(cardio.meters / METERS_IN_KM)} км, ${formatSeconds(cardio.seconds)}`}
                  </AppText>
                </Panel>
              ) : null}

              <Panel>
                <AppText variant="heading">Вес тела</AppText>
                {weight.length > 0 ? (
                  <>
                    <TrendBars
                      bars={weight.map((entry) => ({
                        key: entry.day,
                        value: entry.weightKg,
                        label: dayLabel(entry.day, `${formatNumber(entry.weightKg)} кг`),
                      }))}
                    />
                    {weightChange !== null ? (
                      <AppText variant="callout" tone="secondary">
                        {`Изменение за период: ${weightChange > 0 ? '+' : ''}${formatNumber(weightChange)} кг`}
                      </AppText>
                    ) : null}
                  </>
                ) : (
                  <NoData text="Записывайте вес, и здесь появится динамика." />
                )}
              </Panel>

              <Panel>
                <AppText variant="heading">{`Питание за ${DAYS_SHOWN} дней`}</AppText>
                {food.length > 0 ? (
                  <>
                    <TrendBars
                      bars={food.map((day) => ({
                        key: day.day,
                        value: day.kcal,
                        label: dayLabel(day.day, formatEnergy(day.kcal)),
                      }))}
                    />
                    <AppText variant="callout" tone="secondary">
                      {`В среднем ${formatEnergy(averageKcal ?? 0)} и ${Math.round(averageProtein ?? 0)} г белка в заполненные дни. Дней с записями: ${food.length}.`}
                    </AppText>
                    {target ? (
                      <AppText variant="callout" tone="secondary">
                        {`Цель: ${formatEnergy(target.kcal)} и ${Math.round(target.protein)} г белка.`}
                      </AppText>
                    ) : null}
                  </>
                ) : (
                  <NoData text="Заполняйте дневник, и здесь появятся средние значения." />
                )}
              </Panel>

              <Panel>
                <AppText variant="heading">Шаги</AppText>
                {steps.length > 0 ? (
                  <>
                    <TrendBars
                      bars={steps.map((day) => ({
                        key: day.day,
                        value: day.steps,
                        label: dayLabel(day.day, `${formatNumber(day.steps)} ${pluralize(day.steps, ['шаг', 'шага', 'шагов'])}`),
                      }))}
                    />
                    <AppText variant="callout" tone="secondary">
                      {`В среднем ${formatNumber(Math.round(averageSteps ?? 0))} в день по данным iPhone.`}
                    </AppText>
                  </>
                ) : (
                  <NoData text="Появятся после разрешения доступа к шагам на Главной." />
                )}
              </Panel>

              <Panel>
                <AppText variant="heading">Сон</AppText>
                {sleep.length > 0 ? (
                  <>
                    <TrendBars
                      bars={sleep.map((checkin) => ({
                        key: checkin.day,
                        value: checkin.sleepHours as number,
                        label: dayLabel(checkin.day, `${formatNumber(checkin.sleepHours as number)} ч`),
                      }))}
                    />
                    <AppText variant="callout" tone="secondary">
                      {`В среднем ${formatNumber(Math.round((averageSleep ?? 0) * 10) / 10)} ч по вашим отметкам.`}
                    </AppText>
                  </>
                ) : (
                  <NoData text="Отмечайте сон на Главной, и здесь появится динамика." />
                )}
              </Panel>
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
