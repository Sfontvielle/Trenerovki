import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { MonthCalendar } from '@/components/month-calendar';
import { Stat } from '@/components/stat';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, ListGroup, ListRow, Panel, Segmented, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { dayKey } from '@/domains/nutrition/nutrition';
import { getExerciseRecords, getSummary, listCompletedSessions } from '@/domains/progress/progress-repository';
import { formatDuration, sessionDurationMs } from '@/domains/workout/session-time';
import { SessionBar } from '@/features/workout/session-bar';
import { formatDate, formatNumber, formatWeight, pluralize } from '@/lib/format';
import { t } from '@/lib/i18n';

type Section = 'overview' | 'history' | 'records';

export default function ProgressScreen() {
  const { database } = useAppData();
  const { theme } = useTheme();
  const { colors, spacing } = theme;
  const [section, setSection] = useState<Section>('overview');

  const load = useCallback(async () => {
    const now = new Date();
    const [summary, sessions, records] = await Promise.all([
      getSummary(database, now),
      listCompletedSessions(database),
      getExerciseRecords(database),
    ]);
    return { now, summary, sessions, records };
  }, [database]);
  const state = useScreenData(load);

  return (
    <TabScreen title={t('Прогресс')}>
      <SessionBar />
      <DataView state={state}>
        {({ now, summary, sessions, records }) =>
          sessions.length === 0 ? (
            <>
              <Panel>
                <AppText variant="heading">{t('Пока нет завершённых тренировок')}</AppText>
                <AppText tone="secondary">{t('После первой тренировки здесь появятся история и рекорды.')}</AppText>
                <Button
                  label={t('Перейти к тренировкам')}
                  variant="secondary"
                  onPress={() => router.navigate('/workouts')}
                />
              </Panel>
              <ListGroup>
                <ListRow
                  icon={{ name: 'scalemass', glyph: '⚖', color: colors.accent }}
                  onPress={() => router.push('/body-weight')}
                  title={t('Вес тела')}
                />
              </ListGroup>
            </>
          ) : (
            <>
              <Segmented
                label={t('Разделы прогресса')}
                onChange={setSection}
                options={[
                  { value: 'overview', label: t('Обзор') },
                  { value: 'history', label: t('История') },
                  { value: 'records', label: t('Рекорды') },
                ]}
                value={section}
              />

              {section === 'overview' ? (
                <>
                  <View style={{ flexDirection: 'row', gap: spacing.m }}>
                    <Stat
                      label={pluralize(summary.completedWorkouts, [t('тренировка'), t('тренировки'), t('тренировок')])}
                      size="large"
                      value={formatNumber(summary.completedWorkouts)}
                    />
                    <Stat label={t('за 7 дней')} size="large" value={formatNumber(summary.workoutsLastWeek)} />
                    {summary.totalVolumeKg > 0 ? (
                      <Stat label={t('Объём, кг')} size="large" value={formatNumber(summary.totalVolumeKg)} />
                    ) : null}
                  </View>

                  <MonthCalendar
                    now={now}
                    trainedDays={sessions.map(({ finishedAt }) => dayKey(new Date(finishedAt)))}
                  />

                  <ListGroup>
                    <ListRow
                      icon={{ name: 'chart.bar', glyph: '▮', color: colors.accent }}
                      onPress={() => router.push('/analytics')}
                      title={t('Подробная аналитика')}
                    />
                    <ListRow
                      icon={{ name: 'scalemass', glyph: '⚖', color: colors.accent }}
                      onPress={() => router.push('/body-weight')}
                      title={t('Вес тела')}
                    />
                  </ListGroup>
                </>
              ) : null}

              {section === 'history' ? (
                <ListGroup>
                  {sessions.map((session) => (
                    <ListRow
                      key={session.id}
                      onPress={() => router.push(`/history/${session.id}`)}
                      subtitle={[
                        formatDate(session.startedAt),
                        formatDuration(sessionDurationMs(session, now)),
                        `${session.setCount} ${pluralize(session.setCount, [t('подход'), t('подхода'), t('подходов')])}`,
                        session.volumeKg > 0 ? t('{0} кг', { 0: formatNumber(session.volumeKg) }) : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                      title={session.title}
                    />
                  ))}
                </ListGroup>
              ) : null}

              {section === 'records' ? (
                records.length > 0 ? (
                  <ListGroup>
                    {records.map((record) => (
                      <ListRow
                        key={record.exerciseId}
                        onPress={() => router.push(`/exercise-progress/${record.exerciseId}`)}
                        subtitle={`${formatWeight(record.bestWeightKg)} × ${record.repsAtBest}`}
                        title={exerciseName(record.exerciseId)}
                      />
                    ))}
                  </ListGroup>
                ) : (
                  <AppText tone="secondary">{t('Рекорды появятся после подходов с весом.')}</AppText>
                )
              ) : null}
            </>
          )
        }
      </DataView>
    </TabScreen>
  );
}
