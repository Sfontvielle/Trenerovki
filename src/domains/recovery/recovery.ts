import { t } from '@/lib/i18n';

export const MIN_SLEEP_HOURS = 0;
export const MAX_SLEEP_HOURS = 16;

export type Rating = 1 | 2 | 3 | 4 | 5;

export type Checkin = {
  day: string;
  sleepHours: number | null;
  sleepQuality: Rating | null;
  energy: Rating | null;
  soreness: Rating | null;
  stress: Rating | null;
  note: string | null;
};

export type ReadinessLevel = 'high' | 'medium' | 'low';

export type Readiness = {
  level: ReadinessLevel;
  reasons: string[];
  sources: string[];
};

const SHORT_SLEEP_HOURS = 6;
const FAIR_SLEEP_HOURS = 7;
const CLOSE_WORKOUTS = 2;
const HIGH_LIMIT = 1;
const MEDIUM_LIMIT = 3;

export function isValidSleep(hours: number | null) {
  return (
    hours === null || (Number.isFinite(hours) && hours >= MIN_SLEEP_HOURS && hours <= MAX_SLEEP_HOURS)
  );
}

// A rough self-assessment, not a measurement: it stays silent without sleep and
// at least one feeling, and always says what it was based on.
export function assessReadiness(checkin: Checkin | null, workoutsInTwoDays: number): Readiness | null {
  if (!checkin || checkin.sleepHours === null || (checkin.energy === null && checkin.soreness === null)) {
    return null;
  }

  let penalty = 0;
  const reasons: string[] = [];
  const sources = [t('сон')];

  if (checkin.sleepHours < SHORT_SLEEP_HOURS) {
    penalty += 2;
    reasons.push(t('мало сна'));
  } else if (checkin.sleepHours < FAIR_SLEEP_HOURS) {
    penalty += 1;
    reasons.push(t('сна чуть меньше обычного ориентира'));
  }

  if (checkin.energy !== null) {
    sources.push(t('энергия'));
    if (checkin.energy <= 2) {
      penalty += 2;
      reasons.push(t('мало энергии'));
    } else if (checkin.energy === 3) {
      penalty += 1;
    }
  }

  if (checkin.soreness !== null) {
    sources.push(t('мышечная боль'));
    if (checkin.soreness >= 4) {
      penalty += 2;
      reasons.push(t('сильная мышечная боль'));
    } else if (checkin.soreness === 3) {
      penalty += 1;
    }
  }

  if (checkin.stress !== null) {
    sources.push(t('стресс'));
    if (checkin.stress >= 4) {
      penalty += 1;
      reasons.push(t('высокий стресс'));
    }
  }

  if (workoutsInTwoDays >= CLOSE_WORKOUTS) {
    penalty += 1;
    reasons.push(t('две тренировки за последние два дня'));
  }
  sources.push(t('история тренировок'));

  const level: ReadinessLevel = penalty <= HIGH_LIMIT ? 'high' : penalty <= MEDIUM_LIMIT ? 'medium' : 'low';
  return { level, reasons, sources };
}
