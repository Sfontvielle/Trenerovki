import type { ProposalChange } from '@/domains/coach/proposals';
import { exerciseName } from '@/domains/exercises/catalog';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';

export function describeChange(change: ProposalChange) {
  switch (change.type) {
    case 'replace':
      return t('Было: {0}. Станет: {1}.', { 0: exerciseName(change.fromExerciseId), 1: exerciseName(change.toExerciseId) });
    case 'sets':
      return t('Было: подходов {0}. Станет: подходов {1}.', { 0: change.from, 1: change.to });
    case 'deload':
      return t('До {0} на один подход меньше в упражнениях, где их два и больше.', { 0: formatDate(`${change.untilDay}T12:00:00`) });
    case 'days':
      return t('Тренировок в неделю: было {0}, станет {1}. План будет составлен заново, вернуть прежний можно в истории решений.', { 0: change.from, 1: change.to });
  }
}
