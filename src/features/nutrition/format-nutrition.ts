import { type Nutrients, shiftDay } from '@/domains/nutrition/nutrition';
import { formatDate, formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n';

export function formatEnergy(kcal: number) {
  return t('{0} ккал', { 0: formatNumber(Math.round(kcal)) });
}

export function formatMacros({ protein, fat, carbs }: Nutrients) {
  return t('Б {0} г, Ж {1} г, У {2} г', { 0: Math.round(protein), 1: Math.round(fat), 2: Math.round(carbs) });
}

export function formatDayLabel(day: string, today: string) {
  if (day === today) {
    return t('Сегодня');
  }
  if (day === shiftDay(today, -1)) {
    return t('Вчера');
  }
  return formatDate(`${day}T12:00:00`);
}
