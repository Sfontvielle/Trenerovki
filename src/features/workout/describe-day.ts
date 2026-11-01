import { findExercise, muscleGroupLabels } from '@/domains/exercises/catalog';
import type { ProgramExercise } from '@/domains/program/program-repository';
import { pluralize } from '@/lib/format';
import { t } from '@/lib/i18n';

const GROUPS_SHOWN = 3;

export function describeDay({ exercises }: { exercises: ProgramExercise[] }) {
  const groups = [...new Set(exercises.flatMap(({ exerciseId }) => findExercise(exerciseId)?.muscleGroup ?? []))];
  const count = `${exercises.length} ${pluralize(exercises.length, [t('упражнение'), t('упражнения'), t('упражнений')])}`;
  return [count, ...groups.slice(0, GROUPS_SHOWN).map((group) => muscleGroupLabels[group].toLowerCase())].join(', ');
}
