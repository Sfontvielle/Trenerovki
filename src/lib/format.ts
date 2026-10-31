import { language, locale, t } from './i18n';

export function parseDecimal(text: string) {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export function formatInputNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '' : language === 'ru' ? String(value).replace('.', ',') : String(value);
}

export function formatNumber(value: number) {
  return value.toLocaleString(locale, { maximumFractionDigits: 2 });
}

export function formatWeight(weightKg: number | null) {
  return weightKg === null ? t('Свой вес') : t('{0} кг', { 0: formatNumber(weightKg) });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function normalizeSearch(text: string) {
  return text.trim().toLocaleLowerCase(locale).replaceAll('ё', 'е');
}

export function pluralize(count: number, [one, few, many]: [string, string, string]) {
  if (language !== 'ru') {
    return Math.abs(count) === 1 ? one : many;
  }
  const lastTwo = Math.abs(count) % 100;
  const last = lastTwo % 10;
  if (lastTwo > 10 && lastTwo < 20) {
    return many;
  }
  if (last === 1) {
    return one;
  }
  return last >= 2 && last <= 4 ? few : many;
}

export function formatRepRange(repsMin: number | null, repsMax: number | null) {
  if (repsMin === null || repsMax === null) {
    return null;
  }
  return repsMin === repsMax ? String(repsMin) : `${repsMin}–${repsMax}`;
}
