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
import { SessionBar } from '@/features/workout/session-bar';
import { formatDate, formatNumber, formatWeight, pluralize } from '@/lib/format';
import { t } from '@/lib/i18n';

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
    <TabScreen title={t('Прогресс')}>
      <SessionBar />
      <Button label={t('Подробная аналитика')} variant="secondary" onPress={() => router.push('/analytics')} />
      <Button label={t('Вес тела')} variant="secondary" onPress={() => router.push('/body-weight')} />
      <DataView state={state}>
        {({ summary, sessions, records }) =>
          sessions.length === 0 ? (
            <Panel>
              <AppText variant="heading">{t('Пока нет завершённых тренировок')}</AppText>
              <AppText tone="secondary">{t('После первой тренировки здесь появятся история и рекорды.')}</AppText>
              <Button
                label={t('Перейти к тренировкам')}
                variant="secondary"
                onPress={() => router.navigate('/workouts')}
              />
            </Panel>
          ) : (
            <>
              <Panel>
                <AppText variant="display">{formatNumber(summary.completedWorkouts)}</AppText>
                <AppText tone="secondary">
                  {t('{0} всего, {1} за 7 дней', { 0: pluralize(summary.completedWorkouts, [t('тренировка'), t('тренировки'), t('тренировок')]), 1: summary.workoutsLastWeek })}
                </AppText>
                {summary.totalVolumeKg > 0 ? (
                  <AppText variant="callout" tone="secondary">
                    {t('Общий объём: {0} кг', { 0: formatNumber(summary.totalVolumeKg) })}
                  </AppText>
                ) : null}
              </Panel>

              {records.length > 0 ? (
                <View style={{ gap: theme.spacing.s }}>
                  <AppText accessibilityRole="header" variant="heading">
                    {t('Рекорды')}
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
                  {t('История')}
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
                        {`${formatDate(session.startedAt)}, ${formatDuration(sessionDurationMs(session, new Date()))}`}
                      </AppText>
                      <AppText variant="callout" tone="secondary">
                        {`${session.setCount} ${pluralize(session.setCount, [t('подход'), t('подхода'), t('подходов')])}${session.volumeKg > 0 ? t(', {0} кг', { 0: formatNumber(session.volumeKg) }) : ''}`}
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
