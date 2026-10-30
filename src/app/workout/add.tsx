import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { AppText, Panel, Screen, TextField, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { type Exercise, exercises, muscleGroupLabels } from '@/domains/exercises/catalog';
import { describeFailure } from '@/lib/describe-failure';
import { normalizeSearch } from '@/lib/format';

export default function AddExerciseScreen() {
  const { engine, profile } = useAppData();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const adding = useRef(false);

  const normalized = normalizeSearch(query);
  const matches = exercises.filter((exercise) => normalizeSearch(exercise.name).includes(normalized));

  const add = async (exercise: Exercise) => {
    if (adding.current) {
      return;
    }
    adding.current = true;
    setError(null);
    try {
      const session = await engine.getOpenSession();
      if (!session) {
        setError('Нет открытой тренировки.');
        return;
      }
      await engine.addExercise(session.id, exercise.id, createId());
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Упражнение не добавлено. ${describeFailure(cause)}`);
    } finally {
      adding.current = false;
    }
  };

  return (
    <Screen scroll belowHeader>
      <TextField label="Найти упражнение" onChangeText={setQuery} value={query} />
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      {matches.length === 0 ? (
        <AppText tone="secondary">Ничего не найдено. Попробуйте другое название.</AppText>
      ) : null}
      <View style={{ gap: theme.spacing.s }}>
        {matches.map((exercise) => {
          const restricted = exercise.loads.some((area) => profile?.limitations.includes(area));
          return (
            <Pressable key={exercise.id} accessibilityRole="button" onPress={() => add(exercise)}>
              <Panel>
                <AppText>{exercise.name}</AppText>
                <AppText variant="caption" tone="secondary">
                  {muscleGroupLabels[exercise.muscleGroup]}
                </AppText>
                {restricted ? (
                  <AppText variant="caption" tone="warning">
                    Отмечено для зоны из ваших ограничений
                  </AppText>
                ) : null}
              </Panel>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
