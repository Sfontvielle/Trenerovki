export const meals = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof meals)[number];

export const mealLabels: Record<Meal, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const MAX_KCAL_PER_100G = 900;
const MAX_MACROS_PER_100G = 100;
const MAX_PORTION_GRAMS = 5000;
const ENERGY_TOLERANCE = 0.25;
const ENERGY_TOLERANCE_KCAL = 20;

export type Nutrients = {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type Food = Nutrients & {
  id: string;
  name: string;
};

export type FoodEntry = Nutrients & {
  id: string;
  day: string;
  meal: Meal;
  name: string;
  grams: number;
};

export function isValidGrams(grams: number | null): grams is number {
  return grams !== null && Number.isFinite(grams) && grams > 0 && grams <= MAX_PORTION_GRAMS;
}

export function areValidNutrients({ kcal, protein, fat, carbs }: Nutrients) {
  const values = [kcal, protein, fat, carbs];
  return (
    values.every((value) => Number.isFinite(value) && value >= 0) &&
    kcal <= MAX_KCAL_PER_100G &&
    protein + fat + carbs <= MAX_MACROS_PER_100G
  );
}

export function energyLooksWrong({ kcal, protein, fat, carbs }: Nutrients) {
  const expected = protein * 4 + fat * 9 + carbs * 4;
  const allowed = Math.max(ENERGY_TOLERANCE_KCAL, expected * ENERGY_TOLERANCE);
  return Math.abs(kcal - expected) > allowed;
}

export function portionOf(per100g: Nutrients, grams: number): Nutrients {
  const factor = grams / 100;
  return {
    kcal: per100g.kcal * factor,
    protein: per100g.protein * factor,
    fat: per100g.fat * factor,
    carbs: per100g.carbs * factor,
  };
}

export function sumNutrients(items: Nutrients[]): Nutrients {
  return items.reduce(
    (total, item) => ({
      kcal: total.kcal + item.kcal,
      protein: total.protein + item.protein,
      fat: total.fat + item.fat,
      carbs: total.carbs + item.carbs,
    }),
    { kcal: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function shiftDay(key: string, days: number) {
  const [year, month, day] = key.split('-').map(Number);
  return dayKey(new Date(year, month - 1, day + days));
}
