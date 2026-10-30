import type { WorkoutSet } from './types';

const LIGHT_WEIGHT_LIMIT_KG = 20;
const LIGHT_WEIGHT_STEP_KG = 1;
const WEIGHT_STEP_KG = 2.5;

export function suggestNextWeight(
  lastSets: WorkoutSet[],
  repsMax: number | null,
  plannedSets: number | null,
) {
  if (repsMax === null || lastSets.length === 0 || lastSets.length < (plannedSets ?? 0)) {
    return null;
  }

  const heaviest = Math.max(...lastSets.map((set) => set.weightKg ?? 0));
  const readyToProgress = lastSets.every(
    (set) => set.weightKg === heaviest && set.reps >= repsMax && set.rir !== null && set.rir >= 1,
  );
  if (!readyToProgress || heaviest <= 0) {
    return null;
  }

  return heaviest + (heaviest < LIGHT_WEIGHT_LIMIT_KG ? LIGHT_WEIGHT_STEP_KG : WEIGHT_STEP_KG);
}
