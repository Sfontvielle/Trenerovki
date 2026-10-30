import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TrendBars } from '@/components/trend-bars';
import { AppText, Panel, Screen, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { getExerciseTrend } from '@/domains/progress/progress-repository';
import { formatDate, formatWeight } from '@/lib/format';

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
        {(trend) =>
          trend.length === 0 ? (
            <AppText tone="secondary">Для этого упражнения пока нет завершённых подходов с весом.</AppText>
          ) : (
            <>
              <Panel>
                <AppText variant="heading">Лучший вес по тренировкам</AppText>
                <TrendBars
                  bars={trend.map((point) => ({
                    key: point.sessionId,
                    value: point.topWeightKg,
                    label: `${formatDate(point.finishedAt)}: ${formatWeight(point.topWeightKg)}`,
                  }))}
                />
              </Panel>
              <View style={{ gap: theme.spacing.xs }}>
                {[...trend].reverse().map((point) => (
                  <AppText key={point.sessionId} variant="callout" tone="secondary">
                    {`${formatDate(point.finishedAt)}: ${formatWeight(point.topWeightKg)}`}
                  </AppText>
                ))}
              </View>
            </>
          )
        }
      </DataView>
    </Screen>
  );
}
