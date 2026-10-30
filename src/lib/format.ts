export function parseDecimal(text: string) {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '') {
    return null;
  }
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}

export function formatInputNumber(value: number | null | undefined) {
  return value === null || value === undefined ? '' : String(value).replace('.', ',');
}

export function formatNumber(value: number) {
  return value.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
}

export function formatWeight(weightKg: number | null) {
  return weightKg === null ? 'Свой вес' : `${formatNumber(weightKg)} кг`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function normalizeSearch(text: string) {
  return text.trim().toLocaleLowerCase('ru-RU').replaceAll('ё', 'е');
}

export function pluralize(count: number, [one, few, many]: [string, string, string]) {
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
