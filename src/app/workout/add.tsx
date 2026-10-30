import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { AppText, Panel, Screen, TextField, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { type Exercise, exercises, muscleGroupLabels } from '@/domains/exercises/catalog';

export default function AddExerciseScreen() {
  const { engine } = useAppData();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [failed, setFailed] = useState(false);

  const normalized = query.trim().toLocaleLowerCase('ru-RU');
  const matches = exercises.filter((exercise) =>
    exercise.name.toLocaleLowerCase('ru-RU').includes(normalized),
  );

  const add = async (exercise: Exercise) => {
    setFailed(false);
    try {
      const session = await engine.getOpenSession();
      if (!session) {
        setFailed(true);
        return;
      }
      await engine.addExercise(session.id, exercise.id, createId());
      router.back();
    } catch (error) {
      console.error(error);
      setFailed(true);
    }
  };

  return (
    <Screen scroll belowHeader>
      <TextField label="Найти упражнение" onChangeText={setQuery} value={query} />
      {failed ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          Упражнение не добавлено. Попробуйте ещё раз.
        </AppText>
      ) : null}
      {matches.length === 0 ? (
        <AppText tone="secondary">Ничего не найдено. Попробуйте другое название.</AppText>
      ) : null}
      <View style={{ gap: theme.spacing.s }}>
        {matches.map((exercise) => (
          <Pressable key={exercise.id} accessibilityRole="button" onPress={() => add(exercise)}>
            <Panel>
              <AppText>{exercise.name}</AppText>
              <AppText variant="caption" tone="secondary">
                {muscleGroupLabels[exercise.muscleGroup]}
              </AppText>
            </Panel>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
