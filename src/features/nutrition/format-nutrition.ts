import { type Nutrients, dayKey, shiftDay } from '@/domains/nutrition/nutrition';
import { formatDate, formatNumber } from '@/lib/format';

export function formatEnergy(kcal: number) {
  return `${formatNumber(Math.round(kcal))} ккал`;
}

export function formatMacros({ protein, fat, carbs }: Nutrients) {
  return `Б ${Math.round(protein)} г, Ж ${Math.round(fat)} г, У ${Math.round(carbs)} г`;
}

export function formatDayLabel(day: string, now: Date) {
  const today = dayKey(now);
  if (day === today) {
    return 'Сегодня';
  }
  if (day === shiftDay(today, -1)) {
    return 'Вчера';
  }
  return formatDate(`${day}T12:00:00`);
}
