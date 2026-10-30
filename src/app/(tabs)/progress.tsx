import { router } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import {
  getExerciseRecords,
  getSummary,
  listCompletedSessions,
} from '@/domains/progress/progress-repository';
import { formatDuration, sessionDurationMs } from '@/domains/workout/session-time';
import { formatDate, formatNumber, formatWeight, pluralize } from '@/lib/format';

export default function ProgressScreen() {
  const { database } = useAppData();
  const { theme } = useTheme();

  const load = useCallback(async () => {
    const [summary, sessions, records] = await Promise.all([
      getSummary(database, new Date()),
      listCompletedSessions(database),
      getExerciseRecords(database),
    ]);
    return { summary, sessions, records };
  }, [database]);
  const state = useScreenData(load);

  return (
    <TabScreen title="Прогресс">
      <DataView state={state}>
        {({ summary, sessions, records }) =>
          sessions.length === 0 ? (
            <Panel>
              <AppText variant="heading">Пока нет завершённых тренировок</AppText>
              <AppText tone="secondary">После первой тренировки здесь появятся история и рекорды.</AppText>
              <Button
                label="Перейти к тренировкам"
                variant="secondary"
                onPress={() => router.navigate('/workouts')}
              />
            </Panel>
          ) : (
            <>
              <Panel>
                <AppText variant="display">{formatNumber(summary.completedWorkouts)}</AppText>
                <AppText tone="secondary">
                  {`${pluralize(summary.completedWorkouts, ['тренировка', 'тренировки', 'тренировок'])} всего, ${summary.workoutsLastWeek} за 7 дней`}
                </AppText>
                <AppText variant="callout" tone="secondary">
                  {`Общий объём: ${formatNumber(summary.totalVolumeKg)} кг`}
                </AppText>
              </Panel>

              {records.length > 0 ? (
                <View style={{ gap: theme.spacing.s }}>
                  <AppText accessibilityRole="header" variant="heading">
                    Рекорды
                  </AppText>
                  {records.map((record) => (
                    <Pressable
                      key={record.exerciseId}
                      accessibilityRole="button"
                      onPress={() => router.push(`/exercise-progress/${record.exerciseId}`)}
                    >
                      <Panel>
                        <AppText>{exerciseName(record.exerciseId)}</AppText>
                        <AppText variant="callout" tone="secondary">
                          {`${formatWeight(record.bestWeightKg)} × ${record.repsAtBest}`}
                        </AppText>
                      </Panel>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={{ gap: theme.spacing.s }}>
                <AppText accessibilityRole="header" variant="heading">
                  История
                </AppText>
                {sessions.map((session) => (
                  <Pressable
                    key={session.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/history/${session.id}`)}
                  >
                    <Panel>
                      <AppText>{session.title}</AppText>
                      <AppText variant="callout" tone="secondary">
                        {`${formatDate(session.finishedAt)}, ${formatDuration(sessionDurationMs(session, new Date()))}`}
                      </AppText>
                      <AppText variant="callout" tone="secondary">
                        {`${session.setCount} ${pluralize(session.setCount, ['подход', 'подхода', 'подходов'])}, ${formatNumber(session.volumeKg)} кг`}
                      </AppText>
                    </Panel>
                  </Pressable>
                ))}
              </View>
            </>
          )
        }
      </DataView>
    </TabScreen>
  );
}
