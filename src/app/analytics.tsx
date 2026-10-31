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
import { t } from '@/lib/i18n';

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
                <AppText variant="heading">{t('Тренировки по неделям')}</AppText>
                {hasWorkouts ? (
                  <>
                    <TrendBars
                      bars={weeks.map(({ weeksAgo, workouts }) => ({
                        key: String(weeksAgo),
                        value: workouts,
                        label: `${weeksAgo === 0 ? t('Последние 7 дней') : t('{0} нед. назад', { 0: weeksAgo })}: ${workouts}`,
                      }))}
                    />
                    <AppText variant="callout" tone="secondary">
                      {t('Недель подряд с тренировками: {0}', { 0: streak })}
                    </AppText>
                  </>
                ) : (
                  <NoData text={t('Появится после первой завершённой тренировки.')} />
                )}
              </Panel>

              {hasVolume ? (
                <Panel>
                  <AppText variant="heading">{t('Объём по неделям')}</AppText>
                  <TrendBars
                    bars={weeks.map(({ weeksAgo, volumeKg }) => ({
                      key: String(weeksAgo),
                      value: volumeKg,
                      label: t('{0}: {1} кг', { 0: weeksAgo === 0 ? t('Последние 7 дней') : t('{0} нед. назад', { 0: weeksAgo }), 1: formatNumber(volumeKg) }),
                    }))}
                  />
                  <AppText variant="caption" tone="secondary">
                    {t('Сумма «вес × повторы» без разминочных подходов.')}
                  </AppText>
                </Panel>
              ) : null}

              {groups.length > 0 ? (
                <Panel>
                  <AppText variant="heading">{t('Подходы по группам мышц за 4 недели')}</AppText>
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
                  <AppText variant="heading">{t('Кардио за 4 недели')}</AppText>
                  <AppText tone="secondary">
                    {t('{0} км, {1}', { 0: formatNumber(cardio.meters / METERS_IN_KM), 1: formatSeconds(cardio.seconds) })}
                  </AppText>
                </Panel>
              ) : null}

              <Panel>
                <AppText variant="heading">{t('Вес тела')}</AppText>
                {weight.length > 0 ? (
                  <>
                    <TrendBars
                      bars={weight.map((entry) => ({
                        key: entry.day,
                        value: entry.weightKg,
                        label: dayLabel(entry.day, t('{0} кг', { 0: formatNumber(entry.weightKg) })),
                      }))}
                    />
                    {weightChange !== null ? (
                      <AppText variant="callout" tone="secondary">
                        {t('Изменение за период: {0}{1} кг', { 0: weightChange > 0 ? '+' : '', 1: formatNumber(weightChange) })}
                      </AppText>
                    ) : null}
                  </>
                ) : (
                  <NoData text={t('Записывайте вес, и здесь появится динамика.')} />
                )}
              </Panel>

              <Panel>
                <AppText variant="heading">{t('Питание за {0} дней', { 0: DAYS_SHOWN })}</AppText>
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
                      {t('В среднем {0} и {1} г белка в заполненные дни. Дней с записями: {2}.', { 0: formatEnergy(averageKcal ?? 0), 1: Math.round(averageProtein ?? 0), 2: food.length })}
                    </AppText>
                    {target ? (
                      <AppText variant="callout" tone="secondary">
                        {t('Цель: {0} и {1} г белка.', { 0: formatEnergy(target.kcal), 1: Math.round(target.protein) })}
                      </AppText>
                    ) : null}
                  </>
                ) : (
                  <NoData text={t('Заполняйте дневник, и здесь появятся средние значения.')} />
                )}
              </Panel>

              <Panel>
                <AppText variant="heading">{t('Шаги')}</AppText>
                {steps.length > 0 ? (
                  <>
                    <TrendBars
                      bars={steps.map((day) => ({
                        key: day.day,
                        value: day.steps,
                        label: dayLabel(day.day, `${formatNumber(day.steps)} ${pluralize(day.steps, [t('шаг'), t('шага'), t('шагов')])}`),
                      }))}
                    />
                    <AppText variant="callout" tone="secondary">
                      {t('В среднем {0} в день по данным iPhone.', { 0: formatNumber(Math.round(averageSteps ?? 0)) })}
                    </AppText>
                  </>
                ) : (
                  <NoData text={t('Появятся после разрешения доступа к шагам на Главной.')} />
                )}
              </Panel>

              <Panel>
                <AppText variant="heading">{t('Сон')}</AppText>
                {sleep.length > 0 ? (
                  <>
                    <TrendBars
                      bars={sleep.map((checkin) => ({
                        key: checkin.day,
                        value: checkin.sleepHours as number,
                        label: dayLabel(checkin.day, t('{0} ч', { 0: formatNumber(checkin.sleepHours as number) })),
                      }))}
                    />
                    <AppText variant="callout" tone="secondary">
                      {t('В среднем {0} ч по вашим отметкам.', { 0: formatNumber(Math.round((averageSleep ?? 0) * 10) / 10) })}
                    </AppText>
                  </>
                ) : (
                  <NoData text={t('Отмечайте сон на Главной, и здесь появится динамика.')} />
                )}
              </Panel>
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
