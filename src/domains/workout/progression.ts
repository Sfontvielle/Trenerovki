import type { WorkoutSet } from './types';

const WEIGHT_STEP_KG = 2.5;

export function suggestNextWeight(lastSets: WorkoutSet[], repsMax: number | null) {
  if (repsMax === null || lastSets.length === 0) {
    return null;
  }

  const heaviest = Math.max(...lastSets.map((set) => set.weightKg ?? 0));
  const readyToProgress = lastSets.every(
    (set) =>
      set.weightKg === heaviest && set.reps >= repsMax && (set.rir === null || set.rir >= 1),
  );

  return readyToProgress && heaviest > 0 ? heaviest + WEIGHT_STEP_KG : null;
}
