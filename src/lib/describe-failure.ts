import { WorkoutError, type WorkoutErrorCode } from '@/domains/workout/types';
import { t } from '@/lib/i18n';

const NO_SPACE_MESSAGE = t('На iPhone закончилось место. Освободите память и попробуйте ещё раз.');
const DEFAULT_MESSAGE = t('Не получилось. Попробуйте ещё раз.');

const workoutMessages: Record<WorkoutErrorCode, string> = {
  session_already_open: t('Уже есть незавершённая тренировка. Завершите или отмените её.'),
  session_not_found: t('Тренировка не найдена.'),
  exercise_not_found: t('Упражнение больше не входит в тренировку.'),
  exercise_has_sets: t('Сначала удалите записанные подходы этого упражнения.'),
  no_next_exercise: t('Следующего упражнения нет.'),
  set_not_found: t('Подход уже удалён.'),
  last_set: t('В завершённой тренировке должен остаться хотя бы один подход.'),
  session_not_completed: t('Эта тренировка ещё не завершена.'),
  invalid_transition: t('Состояние тренировки уже изменилось. Проверьте её и повторите.'),
  session_not_active: t('Тренировка на паузе или уже завершена.'),
  invalid_set: t('Проверьте значения подхода.'),
};

export function describeFailure(error: unknown) {
  if (error instanceof WorkoutError) {
    return workoutMessages[error.code];
  }
  if (error instanceof Error && /disk is full|SQLITE_FULL|ENOSPC/i.test(error.message)) {
    return NO_SPACE_MESSAGE;
  }
  return DEFAULT_MESSAGE;
}
