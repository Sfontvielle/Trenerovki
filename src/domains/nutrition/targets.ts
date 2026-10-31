import type { ActivityLevel, Goal, Profile } from '../profile/profile';
import type { Nutrients } from './nutrition';

const activityFactors: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
};

const goalFactors: Record<Goal, number> = {
  fat_loss: 0.85,
  recomposition: 0.95,
  maintenance: 1,
  strength: 1.05,
  muscle: 1.1,
};

const proteinPerKg: Record<Goal, number> = {
  fat_loss: 1.8,
  recomposition: 1.8,
  muscle: 1.6,
  strength: 1.6,
  maintenance: 1.4,
};

const FAT_PER_KG = 0.8;
const MIN_KCAL_MALE = 1500;
export const MIN_KCAL_OTHER = 1200;
const UNDERWEIGHT_BMI = 18.5;
const REFERENCE_BMI = 25;
const KCAL_PER_GRAM_PROTEIN = 4;
const KCAL_PER_GRAM_FAT = 9;
const KCAL_PER_GRAM_CARBS = 4;

type TargetProfile = Pick<Profile, 'sex' | 'age' | 'weightKg' | 'heightCm' | 'activityLevel' | 'goal'>;

// Mifflin-St Jeor resting energy with an activity factor. When sex is not
// given the two published constants are averaged. This is an estimate for
// planning: the floor keeps it from suggesting a crash diet, a low body weight
// never gets a deficit, and at a high weight protein and fat follow a reference
// weight, because grams per kilogram would otherwise exceed the calories.
export function estimateTargets({ sex, age, weightKg, heightCm, activityLevel, goal }: TargetProfile): (Nutrients & { lowWeight: boolean }) | null {
  if (weightKg === null || heightCm === null || activityLevel === null) {
    return null;
  }
  const sexConstant = sex === 'male' ? 5 : sex === 'female' ? -161 : -78;
  const resting = 10 * weightKg + 6.25 * heightCm - 5 * age + sexConstant;
  const floor = sex === 'male' ? MIN_KCAL_MALE : MIN_KCAL_OTHER;
  const squaredHeight = (heightCm / 100) ** 2;
  const lowWeight = weightKg / squaredHeight < UNDERWEIGHT_BMI;
  const goalFactor = lowWeight ? Math.max(1, goalFactors[goal]) : goalFactors[goal];
  const kcal = Math.max(floor, Math.round(resting * activityFactors[activityLevel] * goalFactor));

  const referenceKg = Math.min(weightKg, REFERENCE_BMI * squaredHeight);
  const protein = Math.round(referenceKg * proteinPerKg[goal]);
  const fat = Math.round(referenceKg * FAT_PER_KG);
  const remaining = kcal - protein * KCAL_PER_GRAM_PROTEIN - fat * KCAL_PER_GRAM_FAT;
  return { kcal, protein, fat, carbs: Math.max(0, Math.round(remaining / KCAL_PER_GRAM_CARBS)), lowWeight };
}
