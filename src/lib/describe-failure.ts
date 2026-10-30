import { WorkoutError, type WorkoutErrorCode } from '@/domains/workout/types';

const NO_SPACE_MESSAGE = 'На iPhone закончилось место. Освободите память и попробуйте ещё раз.';
const DEFAULT_MESSAGE = 'Не получилось. Попробуйте ещё раз.';

const workoutMessages: Record<WorkoutErrorCode, string> = {
  session_already_open: 'Уже есть незавершённая тренировка. Завершите или отмените её.',
  session_not_found: 'Тренировка не найдена.',
  exercise_not_found: 'Упражнение больше не входит в тренировку.',
  exercise_has_sets: 'Сначала удалите записанные подходы этого упражнения.',
  set_not_found: 'Подход уже удалён.',
  invalid_transition: 'Тренировка уже завершена или отменена.',
  session_not_active: 'Тренировка на паузе или уже завершена.',
  invalid_set: 'Проверьте значения подхода.',
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
