import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { Stat } from '@/components/stat';
import { AppText, Button, Icon, ListGroup, ListRow, Panel, Screen, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { getSessionRecords } from '@/domains/progress/progress-repository';
import { formatDuration, sessionDurationMs } from '@/domains/workout/session-time';
import { describeSet } from '@/features/workout/set-labels';
import { useStartWorkout } from '@/features/workout/use-start-workout';
import { formatDate, formatNumber, formatWeight } from '@/lib/format';
import { returnToTabs } from '@/lib/navigation';
import { t } from '@/lib/i18n';

export default function SessionHistoryScreen() {
  const { sessionId, finished } = useLocalSearchParams<{ sessionId: string; finished?: string }>();
  const { database, engine } = useAppData();
  const { theme } = useTheme();
  const { repeat, starting, error } = useStartWorkout();
  const load = useCallback(async () => {
    const [session, open, records] = await Promise.all([
      engine.getSession(sessionId),
      engine.getOpenSession(),
      getSessionRecords(database, sessionId),
    ]);
    return { session, canRepeat: open === null, records };
  }, [database, engine, sessionId]);
  const state = useScreenData(load);

  return (
    <Screen
      scroll
      belowHeader
      footer={finished ? <Button label={t('Готово')} onPress={returnToTabs} /> : undefined}
    >
      <DataView state={state}>
        {({ session, canRepeat, records }) => {
          if (!session || session.state !== 'completed' || !session.finishedAt) {
            return (
              <Panel>
                <AppText variant="heading">{t('Тренировка не найдена')}</AppText>
                <Button label={t('Открыть главную')} variant="secondary" onPress={returnToTabs} />
              </Panel>
            );
          }

          const performed = session.exercises.filter((exercise) => exercise.sets.length > 0);
          const sets = performed.flatMap((exercise) => exercise.sets);
          const volume = sets
            .filter((set) => set.kind !== 'warmup')
            .reduce((total, set) => total + (set.weightKg ?? 0) * (set.reps ?? 0), 0);

          return (
            <>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText accessibilityRole="header" variant="title">
                  {finished ? t('Тренировка завершена') : session.title}
                </AppText>
                <AppText tone="secondary">
                  {finished ? session.title : formatDate(session.startedAt)}
                </AppText>
              </View>

              <View style={{ flexDirection: 'row', gap: theme.spacing.m }}>
                <Stat label={t('Время')} size="large" value={formatDuration(sessionDurationMs(session, new Date()))} />
                <Stat label={t('Подходы')} size="large" value={`${sets.length}`} />
                {volume > 0 ? <Stat label={t('Объём, кг')} size="large" value={formatNumber(volume)} /> : null}
              </View>

              {records.length > 0 ? (
                <ListGroup title={t('Новые рекорды')}>
                  {records.map((record) => (
                    <ListRow
                      key={record.exerciseId}
                      icon={{ name: 'trophy.fill', glyph: '★', color: theme.colors.accent }}
                      onPress={() => router.push(`/exercise-progress/${record.exerciseId}`)}
                      subtitle={t('Было {0}', { 0: formatWeight(record.previousKg) })}
                      title={exerciseName(record.exerciseId)}
                      value={formatWeight(record.weightKg)}
                    />
                  ))}
                </ListGroup>
              ) : null}

              {performed.map((exercise) => (
                <ListGroup key={exercise.id} title={exerciseName(exercise.exerciseId)}>
                  {exercise.sets.map((set) => (
                    <Pressable
                      key={set.id}
                      accessibilityHint={t('Открывает исправление подхода')}
                      accessibilityRole="button"
                      onPress={() => router.push(`/history/set/${set.id}`)}
                      style={{
                        alignItems: 'center',
                        flexDirection: 'row',
                        gap: theme.spacing.s,
                        minHeight: theme.sizes.minTouch,
                        paddingHorizontal: theme.spacing.l,
                      }}
                    >
                      <AppText variant="callout" style={{ flex: 1 }}>
                        {`${set.position}. ${describeSet(set)}`}
                      </AppText>
                      <Icon glyph="›" name="chevron.right" size={theme.sizes.chevron} />
                    </Pressable>
                  ))}
                </ListGroup>
              ))}

              <AppText variant="caption" tone="secondary">
                {t('Нажмите на подход, чтобы исправить ошибку в записи.')}
              </AppText>

              {error ? (
                <AppText accessibilityLiveRegion="polite" tone="danger">
                  {error}
                </AppText>
              ) : null}
              {canRepeat ? (
                <Button
                  label={t('Повторить тренировку')}
                  variant="secondary"
                  loading={starting}
                  onPress={() => repeat(session)}
                />
              ) : null}
              {finished ? null : <Button label={t('Готово')} variant="plain" onPress={returnToTabs} />}
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
