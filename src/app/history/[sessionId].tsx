import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { exerciseName } from '@/domains/exercises/catalog';
import { formatDuration, sessionDurationMs } from '@/domains/workout/session-time';
import { formatDate, formatNumber, formatWeight } from '@/lib/format';
import { returnToTabs } from '@/lib/navigation';

export default function SessionHistoryScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { engine } = useAppData();
  const { theme } = useTheme();
  const load = useCallback(() => engine.getSession(sessionId), [engine, sessionId]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(session) => {
          if (!session || session.state !== 'completed' || !session.finishedAt) {
            return (
              <Panel>
                <AppText variant="heading">Тренировка не найдена</AppText>
                <Button label="Открыть главную" variant="secondary" onPress={returnToTabs} />
              </Panel>
            );
          }

          const performed = session.exercises.filter((exercise) => exercise.sets.length > 0);
          const volume = performed
            .flatMap((exercise) => exercise.sets)
            .reduce((total, set) => total + (set.weightKg ?? 0) * set.reps, 0);

          return (
            <>
              <View style={{ gap: theme.spacing.xs }}>
                <AppText accessibilityRole="header" variant="title">
                  {session.title}
                </AppText>
                <AppText tone="secondary">
                  {`${formatDate(session.startedAt)}, ${formatDuration(sessionDurationMs(session, new Date()))}`}
                </AppText>
                {volume > 0 ? <AppText tone="secondary">{`Объём: ${formatNumber(volume)} кг`}</AppText> : null}
              </View>

              {performed.map((exercise) => (
                <Panel key={exercise.id}>
                  <AppText variant="heading">{exerciseName(exercise.exerciseId)}</AppText>
                  {exercise.sets.map((set) => (
                    <AppText key={set.id} variant="callout" tone="secondary">
                      {`${set.position}. ${formatWeight(set.weightKg)} × ${set.reps}${set.rir === null ? '' : `, запас ${set.rir}`}`}
                    </AppText>
                  ))}
                </Panel>
              ))}

              <Button label="Готово" variant="secondary" onPress={returnToTabs} />
            </>
          );
        }}
      </DataView>
    </Screen>
  );
}
