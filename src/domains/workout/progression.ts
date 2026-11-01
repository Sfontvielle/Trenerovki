import type { WorkoutSet } from './types';

const LIGHT_WEIGHT_LIMIT_KG = 20;
const LIGHT_WEIGHT_STEP_KG = 1;
const WEIGHT_STEP_KG = 2.5;
const REDUCTION = 0.9;
const DURATION_STEP_SEC = 5;

export type SuggestionKind = 'add_weight' | 'add_rep' | 'add_time' | 'reduce_weight' | 'hold';

export type Suggestion = {
  kind: SuggestionKind;
  weightKg: number | null;
  reps: number | null;
  durationSec: number | null;
};

type Target = {
  repsMin: number | null;
  repsMax: number | null;
  plannedSets: number | null;
  targetDurationSec?: number | null;
};

function workingSets(sets: WorkoutSet[]) {
  return sets.filter((set) => set.kind === 'working');
}

function roundWeight(weightKg: number) {
  return Math.round(weightKg / LIGHT_WEIGHT_STEP_KG) * LIGHT_WEIGHT_STEP_KG;
}

function missedRange(sets: WorkoutSet[], repsMin: number) {
  const working = workingSets(sets);
  return working.length > 0 && working.some((set) => (set.reps ?? 0) < repsMin);
}

// Double progression: reps climb through the range first, then the weight goes
// up and reps start again from the bottom. It only advances on clear evidence.
export function suggestNextSet(
  recent: WorkoutSet[][],
  { repsMin, repsMax, plannedSets, targetDurationSec = null }: Target,
): Suggestion | null {
  const [latest = [], before = []] = recent;
  const sets = workingSets(latest);
  if (sets.length === 0 || sets.length < (plannedSets ?? 0)) {
    return null;
  }

  if (sets.every((set) => set.durationSec !== null && set.reps === null)) {
    const shortest = Math.min(...sets.map((set) => set.durationSec as number));
    if (targetDurationSec !== null && shortest < targetDurationSec) {
      return null;
    }
    return { kind: 'add_time', weightKg: null, reps: null, durationSec: shortest + DURATION_STEP_SEC };
  }
  if (repsMax === null || repsMin === null || sets.some((set) => set.reps === null)) {
    return null;
  }

  const heaviest = Math.max(...sets.map((set) => set.weightKg ?? 0));
  const sameWeight = sets.every((set) => (set.weightKg ?? 0) === heaviest);
  const lowestReps = Math.min(...sets.map((set) => set.reps as number));
  const leftReserve = sets.every((set) => set.rir === null || set.rir >= 1);

  if (heaviest > 0 && missedRange(latest, repsMin) && missedRange(before, repsMin)) {
    const lowered = Math.min(roundWeight(heaviest * REDUCTION), heaviest - LIGHT_WEIGHT_STEP_KG);
    return lowered > 0
      ? { kind: 'reduce_weight', weightKg: lowered, reps: repsMin, durationSec: null }
      : { kind: 'hold', weightKg: heaviest, reps: repsMin, durationSec: null };
  }
  if (!sameWeight || lowestReps < repsMin) {
    return { kind: 'hold', weightKg: heaviest > 0 ? heaviest : null, reps: repsMin, durationSec: null };
  }
  if (!leftReserve) {
    return { kind: 'hold', weightKg: heaviest > 0 ? heaviest : null, reps: lowestReps, durationSec: null };
  }
  if (lowestReps < repsMax) {
    return { kind: 'add_rep', weightKg: heaviest > 0 ? heaviest : null, reps: lowestReps + 1, durationSec: null };
  }
  if (heaviest <= 0) {
    return { kind: 'add_rep', weightKg: null, reps: lowestReps + 1, durationSec: null };
  }
  const step = heaviest < LIGHT_WEIGHT_LIMIT_KG ? LIGHT_WEIGHT_STEP_KG : WEIGHT_STEP_KG;
  return { kind: 'add_weight', weightKg: heaviest + step, reps: repsMin, durationSec: null };
}

const COMPOUND_REST_SEC = 120;
const HEAVY_REST_SEC = 180;
const ISOLATION_REST_SEC = 75;
const TIMED_REST_SEC = 45;

export function suggestRestSeconds(options: { isolation: boolean; timed: boolean; heavy: boolean }) {
  if (options.timed) {
    return TIMED_REST_SEC;
  }
  if (options.heavy) {
    return HEAVY_REST_SEC;
  }
  return options.isolation ? ISOLATION_REST_SEC : COMPOUND_REST_SEC;
}
