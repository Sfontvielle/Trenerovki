import { t } from '@/lib/i18n';

export const weekdays = [
  { value: 1, short: t('Пн'), accusative: t('понедельник') },
  { value: 2, short: t('Вт'), accusative: t('вторник') },
  { value: 3, short: t('Ср'), accusative: t('среду') },
  { value: 4, short: t('Чт'), accusative: t('четверг') },
  { value: 5, short: t('Пт'), accusative: t('пятницу') },
  { value: 6, short: t('Сб'), accusative: t('субботу') },
  { value: 0, short: t('Вс'), accusative: t('воскресенье') },
] as const;

export function scheduleHeading(trainingDays: number[], now: Date) {
  if (trainingDays.length === 0) {
    return t('Следующая тренировка');
  }
  const today = now.getDay();
  if (trainingDays.includes(today)) {
    return t('Сегодня по плану');
  }

  const daysAhead = [1, 2, 3, 4, 5, 6].find((offset) => trainingDays.includes((today + offset) % 7));
  const nextDay = weekdays.find(({ value }) => value === (today + (daysAhead ?? 1)) % 7);
  return t('Сегодня отдых. Следующая тренировка в {0}', { 0: nextDay?.accusative });
}
