import type { Database } from '../data-platform/database';
import { type Food, type FoodEntry, type FoodSource, type Meal, type Nutrients, portionOf, sumNutrients } from './nutrition';

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
    'SELECT id, name, kcal, protein, fat, carbs, source FROM food ORDER BY last_used_at DESC, name',
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
  source?: FoodSource;
  barcode?: string | null;
};

// The entry keeps its own values, so later changes to the food never rewrite
// the diary. A repeated entry id applies once.
export async function logFood(database: Database, input: LogFoodInput) {
  const { entryId, foodId, name, per100g, grams, day, meal, now, source = 'user', barcode = null } = input;
  const timestamp = now.toISOString();
  const portion = portionOf(per100g, grams);

  await database.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO food (id, name, kcal, protein, fat, carbs, last_used_at, source, barcode)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO UPDATE SET last_used_at = excluded.last_used_at`,
      [foodId, name.trim(), per100g.kcal, per100g.protein, per100g.fat, per100g.carbs, timestamp, source, barcode],
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

export function findFoodByBarcode(database: Database, barcode: string) {
  return database.first<Food>('SELECT id, name, kcal, protein, fat, carbs, source FROM food WHERE barcode = ?', [
    barcode,
  ]);
}

export type UsualFood = Food & { grams: number };

// What this meal usually contains, so a repeat takes one tap and one confirmation.
export async function listUsualFoods(database: Database, meal: Meal, sinceDay: string, count: number) {
  const rows = await database.all<Food & { food_id: string; grams: number; times: number }>(
    `SELECT food.id, food.name, food.kcal, food.protein, food.fat, food.carbs, food.source,
            food_entry.grams AS grams, COUNT(*) AS times
     FROM food_entry JOIN food ON food.id = food_entry.food_id
     WHERE food_entry.meal = ? AND food_entry.day >= ?
     GROUP BY food.id
     ORDER BY times DESC, MAX(food_entry.created_at) DESC
     LIMIT ?`,
    [meal, sinceDay, count],
  );
  return rows.map(({ id, name, kcal, protein, fat, carbs, source, grams }): UsualFood => ({
    id,
    name,
    kcal,
    protein,
    fat,
    carbs,
    source,
    grams,
  }));
}

export async function copyDay(
  database: Database,
  fromDay: string,
  toDay: string,
  createId: () => string,
  now: Date,
) {
  await database.transaction(async (tx) => {
    const rows = await tx.all<EntryRow>('SELECT * FROM food_entry WHERE day = ? ORDER BY created_at', [fromDay]);
    for (const row of rows) {
      await tx.run(
        `INSERT INTO food_entry
           (id, day, meal, food_id, name, grams, kcal, protein, fat, carbs, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          toDay,
          row.meal,
          row.food_id,
          row.name,
          row.grams,
          row.kcal,
          row.protein,
          row.fat,
          row.carbs,
          now.toISOString(),
        ],
      );
    }
  });
}

export async function getManualTarget(database: Database) {
  return database.first<Nutrients>('SELECT kcal, protein, fat, carbs FROM nutrition_target WHERE id = 1');
}

export async function saveManualTarget(database: Database, target: Nutrients, now: Date) {
  await database.run(
    `INSERT INTO nutrition_target (id, kcal, protein, fat, carbs, updated_at) VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET kcal = excluded.kcal, protein = excluded.protein,
       fat = excluded.fat, carbs = excluded.carbs, updated_at = excluded.updated_at`,
    [target.kcal, target.protein, target.fat, target.carbs, now.toISOString()],
  );
}

export async function clearManualTarget(database: Database) {
  await database.run('DELETE FROM nutrition_target');
}

export type RecipeItem = Nutrients & {
  id: string;
  name: string;
  grams: number;
};

type RecipeInput = {
  id: string;
  name: string;
  items: RecipeItem[];
  // Cooking changes the weight: the finished dish is what gets weighed later.
  totalGrams: number;
};

export async function saveRecipe(database: Database, { id, name, items, totalGrams }: RecipeInput, now: Date) {
  const totals = sumNutrients(items);
  const factor = 100 / totalGrams;

  await database.transaction(async (tx) => {
    await tx.run(
      `INSERT INTO food (id, name, kcal, protein, fat, carbs, last_used_at, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'recipe')`,
      [id, name.trim(), totals.kcal * factor, totals.protein * factor, totals.fat * factor, totals.carbs * factor, now.toISOString()],
    );
    for (const item of items) {
      await tx.run(
        `INSERT INTO recipe_item (id, recipe_id, name, grams, kcal, protein, fat, carbs)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [item.id, id, item.name, item.grams, item.kcal, item.protein, item.fat, item.carbs],
      );
    }
  });
}

export async function listDailyTotals(database: Database, sinceDay: string) {
  return database.all<Nutrients & { day: string }>(
    `SELECT day, SUM(kcal) AS kcal, SUM(protein) AS protein, SUM(fat) AS fat, SUM(carbs) AS carbs
     FROM food_entry WHERE day >= ? GROUP BY day ORDER BY day`,
    [sinceDay],
  );
}
