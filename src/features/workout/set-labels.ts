import type { SetKind, WorkoutSet } from '@/domains/workout/types';
import { formatWeight } from '@/lib/format';

export const setKindLabels: Record<SetKind, string> = {
  working: 'Рабочий',
  warmup: 'Разминка',
  drop: 'Дроп-сет',
  rest_pause: 'Отдых-пауза',
};

export function describeSet(set: WorkoutSet) {
  const kind = set.kind === 'working' ? '' : `${setKindLabels[set.kind]}: `;
  const rir = set.rir === null ? '' : `, запас ${set.rir}`;
  const note = set.note ? `. ${set.note}` : '';
  return `${kind}${formatWeight(set.weightKg)} × ${set.reps}${rir}${note}`;
}
