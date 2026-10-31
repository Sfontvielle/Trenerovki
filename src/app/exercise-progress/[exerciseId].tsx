import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TrendBars } from '@/components/trend-bars';
import { AppText, Panel, Screen, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { type ExerciseTrendPoint, getExerciseTrend } from '@/domains/progress/progress-repository';
import { formatSeconds } from '@/features/workout/set-labels';
import { formatDate, formatWeight } from '@/lib/format';
import { t } from '@/lib/i18n';

function toChart(trend: ExerciseTrendPoint[]) {
  const weighted = trend.filter((point) => point.topWeightKg !== null);

  if (weighted.length > 0) {
    return {
      title: t('Лучший вес по тренировкам'),
      points: weighted.map((point) => ({
        key: point.sessionId,
        value: point.topWeightKg as number,
        label: `${formatDate(point.finishedAt)}: ${formatWeight(point.topWeightKg)}`,
      })),
    };
  }
  if (trend.every((point) => point.bestReps === null)) {
    return {
      title: t('Лучшее время по тренировкам'),
      points: trend.map((point) => ({
        key: point.sessionId,
        value: point.longestSec ?? 0,
        label: `${formatDate(point.finishedAt)}: ${formatSeconds(point.longestSec ?? 0)}`,
      })),
    };
  }
  return {
    title: t('Лучшие повторы по тренировкам'),
    points: trend.map((point) => ({
      key: point.sessionId,
      value: point.bestReps ?? 0,
      label: t('{0}: {1} повт.', { 0: formatDate(point.finishedAt), 1: point.bestReps ?? 0 }),
    })),
  };
}

export default function ExerciseProgressScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { database } = useAppData();
  const { theme } = useTheme();
  const load = useCallback(() => getExerciseTrend(database, exerciseId), [database, exerciseId]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <AppText accessibilityRole="header" variant="title">
        {exerciseName(exerciseId)}
      </AppText>
      <DataView state={state}>
        {(trend) => {
          if (trend.length === 0) {
            return <AppText tone="secondary">{t('Для этого упражнения пока нет завершённых подходов.')}</AppText>;
          }
          const chart = toChart(trend);
          return (
            <>
              <Panel>
                <AppText variant="heading">{chart.title}</AppText>
                <TrendBars bars={chart.points} />
              </Panel>
              <View style={{ gap: theme.spacing.xs }}>
                {[...chart.points].reverse().map((point) => (
                  <AppText key={point.key} variant="callout" tone="secondary">
                    {point.label}
                  </AppText>
                ))}
              </View>
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
