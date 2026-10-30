export type Sex = 'male' | 'female';
export type Goal = 'muscle' | 'fat_loss' | 'recomposition' | 'strength' | 'maintenance';
export type Experience = 'beginner' | 'intermediate' | 'advanced';
export type Equipment = 'gym' | 'dumbbells' | 'bar' | 'bodyweight';
export type Limitation = 'shoulders' | 'knees' | 'lower_back';

export const MIN_AGE = 18;
export const MAX_AGE = 100;
export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 300;

export const allowedDaysPerWeek = [2, 3, 4, 5] as const;
export type DaysPerWeek = (typeof allowedDaysPerWeek)[number];

export const allowedSessionMinutes = [30, 45, 60, 75] as const;
export type SessionMinutes = (typeof allowedSessionMinutes)[number];

export type Profile = {
  name: string;
  sex: Sex | null;
  age: number;
  weightKg: number | null;
  goal: Goal;
  experience: Experience;
  daysPerWeek: DaysPerWeek;
  sessionMinutes: SessionMinutes;
  equipment: Equipment;
  limitations: Limitation[];
};

export function isValidName(name: string) {
  return name.trim().length > 0;
}

export function isValidAge(age: number | null): age is number {
  return age !== null && Number.isInteger(age) && age >= MIN_AGE && age <= MAX_AGE;
}

export function isValidWeight(weightKg: number | null) {
  return (
    weightKg === null ||
    (Number.isFinite(weightKg) && weightKg >= MIN_WEIGHT_KG && weightKg <= MAX_WEIGHT_KG)
  );
}
