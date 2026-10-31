import { migrate } from '@/domains/data-platform/migrations';
import { foodCatalog } from '@/domains/nutrition/food-catalog';
import { areValidNutrients, energyLooksWrong } from '@/domains/nutrition/nutrition';
import {
  copyDay,
  findFoodByBarcode,
  listDailyTotals,
  listDayEntries,
  listFoods,
  listUsualFoods,
  logFood,
  saveRecipe,
} from '@/domains/nutrition/nutrition-repository';
import { lookupProduct, parseOpenFoodFacts } from '@/domains/nutrition/product-lookup';
import { estimateTargets } from '@/domains/nutrition/targets';
import { generatePlan } from '@/domains/program/generate-plan';
import { createTestDatabase } from '../../test-support/test-database';

const NOW = new Date('2026-11-16T10:00:00.000Z');

async function setup() {
  const database = createTestDatabase();
  await migrate(database);
  return database;
}

function log(database: Awaited<ReturnType<typeof setup>>, entryId: string, foodId: string, day: string, grams = 100) {
  return logFood(database, {
    entryId,
    foodId,
    name: foodId,
    per100g: { kcal: 100, protein: 10, fat: 1, carbs: 12 },
    grams,
    day,
    meal: 'breakfast',
    now: NOW,
  });
}

describe('food catalog', () => {
  it('has unique ids and names', () => {
    expect(new Set(foodCatalog.map(({ id }) => id)).size).toBe(foodCatalog.length);
    expect(new Set(foodCatalog.map(({ name }) => name)).size).toBe(foodCatalog.length);
  });

  it('holds plausible values for every food', () => {
    for (const food of foodCatalog) {
      expect([food.name, areValidNutrients(food)]).toEqual([food.name, true]);
      expect([food.name, energyLooksWrong(food)]).toEqual([food.name, false]);
    }
  });
});

describe('estimateTargets', () => {
  const body = { sex: 'male', age: 30, weightKg: 80, heightCm: 180, activityLevel: 'moderate', goal: 'maintenance' } as const;

  it('follows Mifflin-St Jeor with activity', () => {
    expect(estimateTargets(body)?.kcal).toBe(Math.round((800 + 1125 - 150 + 5) * 1.55));
  });

  it('adjusts energy and protein for the goal', () => {
    const cut = estimateTargets({ ...body, goal: 'fat_loss' });
    const bulk = estimateTargets({ ...body, goal: 'muscle' });

    expect(cut!.kcal).toBeLessThan(bulk!.kcal);
    expect(cut!.protein).toBe(144);
    expect(bulk!.protein).toBe(128);
  });

  it('adds macros up to the energy target', () => {
    const { kcal, protein, fat, carbs } = estimateTargets(body)!;

    expect(Math.abs(protein * 4 + fat * 9 + carbs * 4 - kcal)).toBeLessThan(5);
  });

  it('never drops under a safe floor', () => {
    const small = { sex: 'female', age: 80, weightKg: 35, heightCm: 130, activityLevel: 'sedentary', goal: 'fat_loss' } as const;

    expect(estimateTargets(small)?.kcal).toBe(1200);
  });

  it('works without sex and stays silent without measurements', () => {
    expect(estimateTargets({ ...body, sex: null })).not.toBeNull();
    expect(estimateTargets({ ...body, heightCm: null })).toBeNull();
    expect(estimateTargets({ ...body, weightKg: null })).toBeNull();
    expect(estimateTargets({ ...body, activityLevel: null })).toBeNull();
  });
});

describe('parseOpenFoodFacts', () => {
  const product = {
    status: 1,
    product: {
      product_name: 'Nutella',
      brands: 'Nutella, Ferrero',
      nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, fat_100g: 30.9, carbohydrates_100g: 57.5 },
    },
  };

  it('reads a complete product', () => {
    expect(parseOpenFoodFacts(product, '123')).toEqual({
      status: 'found',
      product: { name: 'Nutella', barcode: '123', kcal: 539, protein: 6.3, fat: 30.9, carbs: 57.5 },
    });
  });

  it('prefers the Russian name and adds the brand', () => {
    const named = { ...product, product: { ...product.product, product_name_ru: 'Паста', brands: 'Ferrero' } };

    expect(parseOpenFoodFacts(named, '1')).toMatchObject({ product: { name: 'Паста, Ferrero' } });
  });

  it('rejects missing products, gaps and impossible values', () => {
    expect(parseOpenFoodFacts({ status: 0 }, '1')).toEqual({ status: 'not_found' });
    expect(
      parseOpenFoodFacts({ status: 1, product: { product_name: 'Без данных', nutriments: {} } }, '1'),
    ).toEqual({ status: 'incomplete', name: 'Без данных' });
    expect(
      parseOpenFoodFacts(
        { ...product, product: { ...product.product, nutriments: { ...product.product.nutriments, fat_100g: 500 } } },
        '1',
      ).status,
    ).toBe('incomplete');
  });
});

describe('lookupProduct', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends only the barcode and reports what it found', async () => {
    const fetcher = jest.fn(async () => ({ ok: true, status: 200, json: async () => ({ status: 0 }) }));

    expect(await lookupProduct('4600000000000', fetcher)).toEqual({ status: 'not_found' });

    const [url] = fetcher.mock.calls[0] as unknown as [string];
    expect(url).toContain('/product/4600000000000.json');
  });

  it('treats errors and refused requests as offline', async () => {
    expect(await lookupProduct('1', async () => { throw new Error('network'); })).toEqual({ status: 'offline' });
    expect(await lookupProduct('1', async () => ({ ok: false, status: 500, json: async () => ({}) }))).toEqual({
      status: 'offline',
    });
  });

  it('reads the 404 of an unknown barcode as not found, not as no connection', async () => {
    const fetcher = async () => ({ ok: false, status: 404, json: async () => ({ status: 0 }) });

    expect(await lookupProduct('4600000000017', fetcher)).toEqual({ status: 'not_found' });
  });
});

describe('diary helpers', () => {
  it('ranks usual foods by frequency and keeps the latest portion window', async () => {
    const database = await setup();
    await log(database, 'a', 'oats', '2026-11-14');
    await log(database, 'b', 'oats', '2026-11-15');
    await log(database, 'c', 'egg', '2026-11-15');
    await log(database, 'd', 'old', '2026-09-01');

    const usual = await listUsualFoods(database, 'breakfast', '2026-10-17', 2);

    expect(usual.map(({ id }) => id)).toEqual(['oats', 'egg']);
    expect(await listUsualFoods(database, 'dinner', '2026-10-17', 2)).toEqual([]);
  });

  it('copies a day with new ids', async () => {
    const database = await setup();
    await log(database, 'a', 'oats', '2026-11-15', 50);
    let next = 0;

    await copyDay(database, '2026-11-15', '2026-11-16', () => `copy-${++next}`, NOW);

    const copied = await listDayEntries(database, '2026-11-16');
    expect(copied).toMatchObject([{ id: 'copy-1', grams: 50, kcal: 50 }]);
    expect(await listDayEntries(database, '2026-11-15')).toHaveLength(1);
  });

  it('turns ingredients into a dish per 100 g of finished weight', async () => {
    const database = await setup();

    await saveRecipe(
      database,
      {
        id: 'dish',
        name: 'Каша',
        totalGrams: 400,
        items: [
          { id: 'i1', name: 'Овсянка', grams: 100, kcal: 366, protein: 12, fat: 6, carbs: 62 },
          { id: 'i2', name: 'Молоко', grams: 200, kcal: 104, protein: 6, fat: 5, carbs: 10 },
        ],
      },
      NOW,
    );

    const [dish] = await listFoods(database);
    expect(dish).toMatchObject({ source: 'recipe', kcal: 117.5, protein: 4.5 });
  });

  it('finds a remembered barcode', async () => {
    const database = await setup();
    await logFood(database, {
      entryId: 'e',
      foodId: 'f',
      name: 'Сок',
      per100g: { kcal: 45, protein: 0, fat: 0, carbs: 11 },
      grams: 200,
      day: '2026-11-16',
      meal: 'snack',
      now: NOW,
      source: 'barcode',
      barcode: '111',
    });

    expect((await findFoodByBarcode(database, '111'))?.name).toBe('Сок');
    expect(await findFoodByBarcode(database, '222')).toBeNull();
  });

  it('keeps one food when the same barcode is logged again', async () => {
    const database = await setup();
    const scan = (entryId: string, foodId: string) =>
      logFood(database, {
        entryId,
        foodId,
        name: 'Сок',
        per100g: { kcal: 45, protein: 0, fat: 0, carbs: 11 },
        grams: 200,
        day: '2026-11-16',
        meal: 'snack',
        now: NOW,
        source: 'barcode',
        barcode: '111',
      });

    await scan('e1', 'f1');
    await scan('e2', 'f2');

    expect(await listFoods(database)).toHaveLength(1);
    expect(await listDayEntries(database, '2026-11-16')).toHaveLength(2);
  });

  it('adds up each day for analytics', async () => {
    const database = await setup();
    await log(database, 'a', 'oats', '2026-11-15', 200);
    await log(database, 'b', 'egg', '2026-11-15', 100);
    await log(database, 'c', 'egg', '2026-11-16', 100);

    expect(await listDailyTotals(database, '2026-11-15')).toMatchObject([
      { day: '2026-11-15', kcal: 300 },
      { day: '2026-11-16', kcal: 100 },
    ]);
  });
});

describe('starting form in the plan', () => {
  const plan = {
    goal: 'muscle',
    experience: 'intermediate',
    daysPerWeek: 3,
    sessionMinutes: 45,
    equipment: 'bodyweight',
    limitations: [],
  } as const;

  it('leaves out full push-ups and demanding work for a low baseline', () => {
    const exercises = generatePlan({ ...plan, limitations: [], baseline: 'low' }).flatMap((day) => day.exercises);

    expect(exercises.map(({ exerciseId }) => exerciseId)).not.toContain('push-up');
    expect(exercises.map(({ exerciseId }) => exerciseId)).not.toContain('pike-push-up');
  });
});
