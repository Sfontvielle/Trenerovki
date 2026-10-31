import type { Database } from '../data-platform/database';
import { type Food, type FoodEntry, type Meal, type Nutrients, portionOf } from './nutrition';

type FoodRow = {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

type EntryRow = FoodRow & {
  day: string;
  meal: Meal;
  grams: number;
  food_id: string;
};

function toEntry(row: EntryRow): FoodEntry {
  return {
    id: row.id,
    day: row.day,
    meal: row.meal,
    name: row.name,
    grams: row.grams,
    kcal: row.kcal,
    protein: row.protein,
    fat: row.fat,
    carbs: row.carbs,
  };
}

export function listFoods(database: Database) {
  return database.all<Food>(
    'SELECT id, name, kcal, protein, fat, carbs FROM food ORDER BY last_used_at DESC, name',
  );
}

export function listDayEntries(database: Database, day: string) {
  return database
    .all<EntryRow>('SELECT * FROM food_entry WHERE day = ? ORDER BY created_at', [day])
    .then((rows) => rows.map(toEntry));
}

export async function getEntry(database: Database, entryId: string) {
  const row = await database.first<EntryRow>('SELECT * FROM food_entry WHERE id = ?', [entryId]);
  return row ? toEntry(row) : null;
}

type LogFoodInput = {
  entryId: string;
  foodId: string;
  name: string;
  per100g: Nutrients;
  grams: number;
  day: string;
  meal: Meal;
  now: Date;
};

// The entry keeps its own values, so later changes to the food never rewrite
// the diary. A repeated entry id applies once.
export async function logFood(database: Database, input: LogFoodInput) {
  const { entryId, foodId, name, per100g, grams, day, meal, now } = input;
  const timestamp = now.toISOString();
  const portion = portionOf(per100g, grams);

  await database.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO food (id, name, kcal, protein, fat, carbs, last_used_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET last_used_at = excluded.last_used_at`,
      [foodId, name.trim(), per100g.kcal, per100g.protein, per100g.fat, per100g.carbs, timestamp],
    );
    await tx.run(
      `INSERT INTO food_entry
         (id, day, meal, food_id, name, grams, kcal, protein, fat, carbs, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        entryId,
        day,
        meal,
        foodId,
        name.trim(),
        grams,
        portion.kcal,
        portion.protein,
        portion.fat,
        portion.carbs,
        timestamp,
      ],
    );
  });
}

export async function changeEntryGrams(database: Database, entry: FoodEntry, grams: number) {
  const ratio = grams / entry.grams;
  await database.run(
    'UPDATE food_entry SET grams = ?, kcal = ?, protein = ?, fat = ?, carbs = ? WHERE id = ?',
    [grams, entry.kcal * ratio, entry.protein * ratio, entry.fat * ratio, entry.carbs * ratio, entry.id],
  );
}

export async function deleteEntry(database: Database, entryId: string) {
  await database.run('DELETE FROM food_entry WHERE id = ?', [entryId]);
}
