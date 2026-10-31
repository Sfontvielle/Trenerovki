import type { ProposalChange } from '@/domains/coach/proposals';
import { exerciseName } from '@/domains/exercises/catalog';
import { formatDate } from '@/lib/format';

export function describeChange(change: ProposalChange) {
  switch (change.type) {
    case 'replace':
      return `Было: ${exerciseName(change.fromExerciseId)}. Станет: ${exerciseName(change.toExerciseId)}.`;
    case 'sets':
      return `Было: подходов ${change.from}. Станет: подходов ${change.to}.`;
    case 'deload':
      return `До ${formatDate(`${change.untilDay}T12:00:00`)} на один подход меньше в каждом упражнении.`;
    case 'days':
      return `Было: ${change.from} тренировки в неделю. Станет: ${change.to}. План будет составлен заново, вернуть прежний можно в истории решений.`;
  }
}
