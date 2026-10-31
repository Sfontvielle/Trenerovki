import type { SetKind, WorkoutSet } from '@/domains/workout/types';
import { formatNumber, formatRepRange, formatWeight } from '@/lib/format';

export const setKindLabels: Record<SetKind, string> = {
  working: 'Рабочий',
  warmup: 'Разминка',
  drop: 'Дроп-сет',
  rest_pause: 'Отдых-пауза',
};

const SECONDS_IN_MINUTE = 60;

export function formatSeconds(seconds: number) {
  return seconds >= 120 && seconds % SECONDS_IN_MINUTE === 0
    ? `${seconds / SECONDS_IN_MINUTE} мин`
    : `${seconds} сек`;
}

function formatDistance(meters: number) {
  return `${formatNumber(meters / 1000)} км`;
}

export function describeSet(set: WorkoutSet) {
  const kind = set.kind === 'working' ? '' : `${setKindLabels[set.kind]}: `;
  const rir = set.rir === null ? '' : `, запас ${set.rir}`;
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

export function groupLabel(size: number) {
  if (size === 2) {
    return 'Суперсет';
  }
  return size === 3 ? 'Трисет' : 'Круговая';
}
