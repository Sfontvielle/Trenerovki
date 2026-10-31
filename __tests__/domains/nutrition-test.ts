import type { Database } from '@/domains/data-platform/database';
import { deleteAllData, exportAllData } from '@/domains/data-platform/data-transfer';
import { migrate } from '@/domains/data-platform/migrations';
import {
  areValidNutrients,
  dayKey,
  energyLooksWrong,
  isValidGrams,
  portionOf,
  shiftDay,
  sumNutrients,
} from '@/domains/nutrition/nutrition';
import {
  changeEntryGrams,
  deleteEntry,
  getEntry,
  listDayEntries,
  listFoods,
  logFood,
} from '@/domains/nutrition/nutrition-repository';
import { createTestDatabase } from '../../test-support/test-database';

const oats = { kcal: 366, protein: 12, fat: 6, carbs: 62 };
const now = new Date('2026-11-01T10:00:00.000Z');

async function setup() {
  const database: Database = createTestDatabase();
  await migrate(database);
  return database;
}

function logOats(database: Database, overrides: Partial<Parameters<typeof logFood>[1]> = {}) {
  return logFood(database, {
    entryId: 'entry-1',
    foodId: 'oats',
    name: 'Овсянка',
    per100g: oats,
    grams: 50,
    day: '2026-11-01',
    meal: 'breakfast',
    now,
    ...overrides,
  });
}

describe('nutrition calculations', () => {
  it('scales a portion from values per 100 g', () => {
    expect(portionOf(oats, 50)).toEqual({ kcal: 183, protein: 6, fat: 3, carbs: 31 });
  });

  it('sums a day', () => {
    expect(sumNutrients([portionOf(oats, 100), portionOf(oats, 50)]).kcal).toBe(549);
    expect(sumNutrients([])).toEqual({ kcal: 0, protein: 0, fat: 0, carbs: 0 });
  });

  it('accepts only possible values', () => {
    expect(areValidNutrients(oats)).toBe(true);
    expect(areValidNutrients({ ...oats, kcal: 1000 })).toBe(false);
    expect(areValidNutrients({ ...oats, protein: -1 })).toBe(false);
    expect(areValidNutrients({ ...oats, protein: Number.NaN })).toBe(false);
    expect(areValidNutrients({ kcal: 500, protein: 50, fat: 40, carbs: 20 })).toBe(false);
  });

  it('accepts only sensible portions', () => {
    expect(isValidGrams(50)).toBe(true);
    expect(isValidGrams(0)).toBe(false);
    expect(isValidGrams(null)).toBe(false);
    expect(isValidGrams(6000)).toBe(false);
  });

  it('flags energy that does not match the macros', () => {
    expect(energyLooksWrong(oats)).toBe(false);
    expect(energyLooksWrong({ ...oats, kcal: 100 })).toBe(true);
    expect(energyLooksWrong({ kcal: 5, protein: 0, fat: 0, carbs: 0 })).toBe(false);
  });
});

describe('days', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('moves across months and years', () => {
    expect(shiftDay('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDay('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('diary', () => {
  it('stores a portion and remembers the food', async () => {
    const database = await setup();

    await logOats(database);

    const [entry] = await listDayEntries(database, '2026-11-01');
    expect(entry).toMatchObject({ name: 'Овсянка', meal: 'breakfast', grams: 50, kcal: 183 });
    expect(await listFoods(database)).toEqual([{ id: 'oats', name: 'Овсянка', ...oats }]);
  });

  it('applies a repeated save only once', async () => {
    const database = await setup();

    await logOats(database);
    await logOats(database);

    expect(await listDayEntries(database, '2026-11-01')).toHaveLength(1);
  });

  it('keeps days apart', async () => {
    const database = await setup();

    await logOats(database);

    expect(await listDayEntries(database, '2026-11-02')).toEqual([]);
  });

  it('keeps recorded values when the same food is logged differently later', async () => {
    const database = await setup();
    await logOats(database);

    await logOats(database, { entryId: 'entry-2', per100g: { ...oats, kcal: 999 }, grams: 100 });

    const [first] = await listDayEntries(database, '2026-11-01');
    expect(first.kcal).toBe(183);
    expect((await listFoods(database))[0].kcal).toBe(366);
  });

  it('recalculates an entry when the portion changes', async () => {
    const database = await setup();
    await logOats(database);
    const entry = await getEntry(database, 'entry-1');

    await changeEntryGrams(database, entry!, 100);

    expect(await getEntry(database, 'entry-1')).toMatchObject({ grams: 100, kcal: 366, protein: 12 });
  });

  it('deletes an entry but keeps the food for next time', async () => {
    const database = await setup();
    await logOats(database);

    await deleteEntry(database, 'entry-1');

    expect(await getEntry(database, 'entry-1')).toBeNull();
    expect(await listFoods(database)).toHaveLength(1);
  });

  it('is part of the export and of deleting all data', async () => {
    const database = await setup();
    await logOats(database);

    const exported = JSON.parse(await exportAllData(database));
    expect(exported.tables.food_entry).toHaveLength(1);
    expect(exported.tables.food).toHaveLength(1);

    await deleteAllData(database);
    expect(await listDayEntries(database, '2026-11-01')).toEqual([]);
    expect(await listFoods(database)).toEqual([]);
  });
});
