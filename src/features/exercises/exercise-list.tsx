import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Chip, ListGroup, ListRow, TextField, useTheme } from '@/design-system';
import {
  type ExerciseCategory,
  type MuscleGroup,
  categoryLabels,
  exercises,
  muscleGroupLabels,
} from '@/domains/exercises/catalog';
import { listCustomExercises } from '@/domains/exercises/custom-exercise-repository';
import { normalizeSearch } from '@/lib/format';
import { t } from '@/lib/i18n';

type ExerciseListProps = {
  onPick: (exerciseId: string) => void;
};

const muscleGroups = Object.keys(muscleGroupLabels) as MuscleGroup[];
const categories = Object.keys(categoryLabels) as ExerciseCategory[];

type Filter =
  | { kind: 'all' | 'mine' }
  | { kind: 'category'; value: ExerciseCategory }
  | { kind: 'muscle'; value: MuscleGroup };

export function ExerciseList({ onPick }: ExerciseListProps) {
  const { database, profile } = useAppData();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const load = useCallback(() => listCustomExercises(database), [database]);
  const state = useScreenData(load);

  return (
    <>
      <TextField label={t('Найти упражнение')} onChangeText={setQuery} value={query} />
      <ScrollView
        accessibilityLabel={t('Фильтры')}
        accessibilityRole="radiogroup"
        contentContainerStyle={{ gap: theme.spacing.s }}
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <Chip label={t('Все')} selected={filter.kind === 'all'} onPress={() => setFilter({ kind: 'all' })} />
        <Chip label={t('Подходят мне')} selected={filter.kind === 'mine'} onPress={() => setFilter({ kind: 'mine' })} />
        {categories.map((value) => (
          <Chip
            key={value}
            label={categoryLabels[value]}
            selected={filter.kind === 'category' && filter.value === value}
            onPress={() => setFilter({ kind: 'category', value })}
          />
        ))}
        {muscleGroups.map((value) => (
          <Chip
            key={value}
            label={muscleGroupLabels[value]}
            selected={filter.kind === 'muscle' && filter.value === value}
            onPress={() => setFilter({ kind: 'muscle', value })}
          />
        ))}
      </ScrollView>
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
              (filter.kind !== 'muscle' || exercise.muscleGroup === filter.value) &&
              (filter.kind !== 'category' || exercise.category === filter.value) &&
              (filter.kind !== 'mine' || exercise.own || (profile && exercise.equipment.includes(profile.equipment))),
          );

          if (rows.length === 0) {
            return <AppText tone="secondary">{t('Ничего не найдено. Попробуйте другое название.')}</AppText>;
          }

          return (
            <ListGroup>
              {rows.map((exercise) => {
                const restricted = exercise.loads.some((area) =>
                  profile?.limitations.some((limitation) => limitation === area),
                );
                return (
                  <View key={exercise.id}>
                    <ListRow
                      onPress={() => onPick(exercise.id)}
                      subtitle={
                        exercise.own
                          ? t('{0}, своё упражнение', { 0: muscleGroupLabels[exercise.muscleGroup] })
                          : muscleGroupLabels[exercise.muscleGroup]
                      }
                      title={exercise.name}
                    />
                    {restricted ? (
                      <AppText variant="caption" tone="warning" style={{ paddingBottom: theme.spacing.s, paddingHorizontal: theme.spacing.l }}>
                        {t('Нагружает зону из ваших ограничений')}
                      </AppText>
                    ) : null}
                  </View>
                );
              })}
            </ListGroup>
          );
        }}
      </DataView>
    </>
  );
}
