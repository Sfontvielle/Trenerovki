export const weekdays = [
  { value: 1, short: 'Пн', accusative: 'понедельник' },
  { value: 2, short: 'Вт', accusative: 'вторник' },
  { value: 3, short: 'Ср', accusative: 'среду' },
  { value: 4, short: 'Чт', accusative: 'четверг' },
  { value: 5, short: 'Пт', accusative: 'пятницу' },
  { value: 6, short: 'Сб', accusative: 'субботу' },
  { value: 0, short: 'Вс', accusative: 'воскресенье' },
] as const;

export function scheduleHeading(trainingDays: number[], now: Date) {
  if (trainingDays.length === 0) {
    return 'Следующая тренировка';
  }
  const today = now.getDay();
  if (trainingDays.includes(today)) {
    return 'Сегодня по плану';
  }

  const daysAhead = [1, 2, 3, 4, 5, 6].find((offset) => trainingDays.includes((today + offset) % 7));
  const nextDay = weekdays.find(({ value }) => value === (today + (daysAhead ?? 1)) % 7);
  return `Сегодня отдых. Следующая тренировка в ${nextDay?.accusative}`;
}
