import type { Suggestion } from '@/domains/workout/progression';
import type { SetKind, WorkoutSet } from '@/domains/workout/types';
import { formatNumber, formatRepRange, formatWeight } from '@/lib/format';
import { t } from '@/lib/i18n';

export const setKindLabels: Record<SetKind, string> = {
  working: t('Рабочий'),
  warmup: t('Разминка'),
  drop: t('Дроп-сет'),
  rest_pause: t('Отдых-пауза'),
};

const SECONDS_IN_MINUTE = 60;

export function formatSeconds(seconds: number) {
  return seconds >= 120 && seconds % SECONDS_IN_MINUTE === 0
    ? t('{0} мин', { 0: seconds / SECONDS_IN_MINUTE })
    : t('{0} сек', { 0: seconds });
}

function formatDistance(meters: number) {
  return t('{0} км', { 0: formatNumber(meters / 1000) });
}

export function describeSet(set: WorkoutSet) {
  const kind = set.kind === 'working' ? '' : `${setKindLabels[set.kind]}: `;
  const rir = set.rir === null ? '' : t(', запас {0}', { 0: set.rir });
  const note = set.note ? `. ${set.note}` : '';
  if (set.reps === null) {
    const parts = [
      set.durationSec === null ? null : formatSeconds(set.durationSec),
      set.distanceM === null ? null : formatDistance(set.distanceM),
      set.weightKg === null ? null : formatWeight(set.weightKg),
    ].filter(Boolean);
    return `${kind}${parts.join(', ')}${note}`;
  }
  return `${kind}${formatWeight(set.weightKg)} × ${set.reps}${rir}${note}`;
}

type Target = {
  sets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  durationSec: number | null;
};

export function describeTarget({ sets, repsMin, repsMax, durationSec }: Target) {
  const amount = durationSec !== null ? formatSeconds(durationSec) : formatRepRange(repsMin, repsMax);
  if (amount === null) {
    return null;
  }
  return sets === null ? amount : `${sets} × ${amount}`;
}

export function describeSuggestionShort({ kind, weightKg, reps, durationSec }: Suggestion) {
  const weight = weightKg === null ? '' : formatWeight(weightKg);
  switch (kind) {
    case 'add_weight':
      return t('Можно прибавить: {0} × {1}', { 0: weight, 1: reps });
    case 'add_rep':
      return t('Цель на сегодня: {0} повторов', { 0: reps });
    case 'add_time':
      return t('Цель на сегодня: {0}', { 0: formatSeconds(durationSec as number) });
    case 'reduce_weight':
      return t('Лучше снизить до {0}', { 0: weight });
    default:
      return t('Пока оставьте тот же вес');
  }
}

export function groupLabel(size: number) {
  if (size === 2) {
    return t('Суперсет');
  }
  return size === 3 ? t('Трисет') : t('Круговая');
}
