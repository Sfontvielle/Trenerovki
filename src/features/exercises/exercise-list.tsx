import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { ChoiceGroup } from '@/components/choice-group';
import { DataView } from '@/components/states';
import { AppText, Panel, TextField, useTheme } from '@/design-system';
import {
  type ExerciseCategory,
  type MuscleGroup,
  categoryLabels,
  exercises,
  muscleGroupLabels,
} from '@/domains/exercises/catalog';
import { listCustomExercises } from '@/domains/exercises/custom-exercise-repository';
import { normalizeSearch } from '@/lib/format';

type ExerciseListProps = {
  onPick: (exerciseId: string) => void;
};

const muscleGroups = Object.keys(muscleGroupLabels) as MuscleGroup[];
const categories = Object.keys(categoryLabels) as ExerciseCategory[];

export function ExerciseList({ onPick }: ExerciseListProps) {
  const { database, profile } = useAppData();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [category, setCategory] = useState<ExerciseCategory | null>(null);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const load = useCallback(() => listCustomExercises(database), [database]);
  const state = useScreenData(load);

  return (
    <>
      <TextField label="Найти упражнение" onChangeText={setQuery} value={query} />
      <ChoiceGroup
        choices={[
          { value: null, label: 'Все' },
          ...categories.map((value) => ({ value, label: categoryLabels[value] })),
        ]}
        isSelected={(value) => category === value}
        label="Раздел"
        onSelect={setCategory}
      />
      <ChoiceGroup
        choices={[
          { value: null, label: 'Все' },
          ...muscleGroups.map((value) => ({ value, label: muscleGroupLabels[value] })),
        ]}
        isSelected={(value) => muscle === value}
        label="Группа мышц"
        onSelect={setMuscle}
      />
      <ChoiceGroup
        choices={[
          { value: 'all', label: 'Все условия' },
          { value: 'mine', label: 'Только мои условия' },
        ]}
        isSelected={(value) => (value === 'mine') === onlyAvailable}
        label="Условия"
        onSelect={(value) => setOnlyAvailable(value === 'mine')}
      />
      <DataView state={state}>
        {(custom) => {
          const normalized = normalizeSearch(query);
          const rows = [
            ...custom.map((exercise) => ({
              ...exercise,
              loads: [] as string[],
              category: null as ExerciseCategory | null,
              own: true,
            })),
            ...exercises.map((exercise) => ({ ...exercise, own: false })),
          ].filter(
            (exercise) =>
              normalizeSearch(exercise.name).includes(normalized) &&
              (muscle === null || exercise.muscleGroup === muscle) &&
              (category === null || exercise.category === category) &&
              (!onlyAvailable || exercise.own || (profile && exercise.equipment.includes(profile.equipment))),
          );

          if (rows.length === 0) {
            return <AppText tone="secondary">Ничего не найдено. Попробуйте другое название.</AppText>;
          }

          return (
            <View style={{ gap: theme.spacing.s }}>
              {rows.map((exercise) => {
                const restricted = exercise.loads.some((area) =>
                  profile?.limitations.some((limitation) => limitation === area),
                );
                return (
                  <Pressable
                    key={exercise.id}
                    accessibilityRole="button"
                    onPress={() => onPick(exercise.id)}
                  >
                    <Panel>
                      <AppText>{exercise.name}</AppText>
                      <AppText variant="caption" tone="secondary">
                        {exercise.own
                          ? `${muscleGroupLabels[exercise.muscleGroup]}, своё упражнение`
                          : muscleGroupLabels[exercise.muscleGroup]}
                      </AppText>
                      {restricted ? (
                        <AppText variant="caption" tone="warning">
                          Нагружает зону из ваших ограничений
                        </AppText>
                      ) : null}
                    </Panel>
                  </Pressable>
                );
              })}
            </View>
          );
        }}
      </DataView>
    </>
  );
}
