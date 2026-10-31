import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, TextField, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import {
  type Food,
  type Meal,
  type Nutrients,
  areValidNutrients,
  energyLooksWrong,
  isValidGrams,
  mealLabels,
  portionOf,
} from '@/domains/nutrition/nutrition';
import { listFoods, logFood } from '@/domains/nutrition/nutrition-repository';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { describeFailure } from '@/lib/describe-failure';
import { normalizeSearch, parseDecimal } from '@/lib/format';

type Mode = { type: 'search' } | { type: 'existing'; food: Food } | { type: 'new' };

export default function AddFoodScreen() {
  const { day, meal } = useLocalSearchParams<{ day: string; meal: Meal }>();
  const { database } = useAppData();
  const { theme } = useTheme();
  const { spacing } = theme;
  const [mode, setMode] = useState<Mode>({ type: 'search' });
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');
  const [kcalText, setKcalText] = useState('');
  const [proteinText, setProteinText] = useState('');
  const [fatText, setFatText] = useState('');
  const [carbsText, setCarbsText] = useState('');
  const [gramsText, setGramsText] = useState('');
  const [entryId] = useState(createId);
  const [newFoodId] = useState(createId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => listFoods(database), [database]);
  const state = useScreenData(load);

  const typed: Nutrients = {
    kcal: parseDecimal(kcalText) ?? Number.NaN,
    protein: parseDecimal(proteinText) ?? Number.NaN,
    fat: parseDecimal(fatText) ?? Number.NaN,
    carbs: parseDecimal(carbsText) ?? Number.NaN,
  };
  const per100g = mode.type === 'existing' ? mode.food : typed;
  const grams = parseDecimal(gramsText);
  const ready = areValidNutrients(per100g) && isValidGrams(grams);
  const portion = ready ? portionOf(per100g, grams as number) : null;
  const creating = mode.type === 'new';

  const save = async () => {
    const foodName = mode.type === 'existing' ? mode.food.name : name;
    if (!foodName.trim()) {
      setError('Укажите название продукта.');
      return;
    }
    if (!areValidNutrients(per100g)) {
      setError('Проверьте значения на 100 г: до 900 ккал, а белки, жиры и углеводы вместе до 100 г.');
      return;
    }
    if (!isValidGrams(grams)) {
      setError('Укажите вес порции от 1 до 5000 г.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await logFood(database, {
        entryId,
        foodId: mode.type === 'existing' ? mode.food.id : newFoodId,
        name: foodName,
        per100g,
        grams,
        day,
        meal,
        now: new Date(),
      });
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Запись не сохранена. ${describeFailure(cause)}`);
      setSaving(false);
    }
  };

  return (
    <Screen scroll belowHeader>
      <AppText accessibilityRole="header" variant="title">
        {mealLabels[meal]}
      </AppText>

      {mode.type === 'search' ? (
        <>
          <Button label="Новый продукт" onPress={() => setMode({ type: 'new' })} />
          <DataView state={state}>
            {(foods) => {
              if (foods.length === 0) {
                return <AppText tone="secondary">Здесь появятся продукты, которые вы уже записывали.</AppText>;
              }
              const normalized = normalizeSearch(query);
              const matches = foods.filter((food) => normalizeSearch(food.name).includes(normalized));

              return (
                <>
                  <TextField label="Мои продукты" onChangeText={setQuery} value={query} />
                  {matches.length === 0 ? (
                    <AppText tone="secondary">Ничего не найдено. Добавьте новый продукт.</AppText>
                  ) : null}
                  <View style={{ gap: spacing.s }}>
                    {matches.map((food) => (
                      <Pressable
                        key={food.id}
                        accessibilityRole="button"
                        onPress={() => setMode({ type: 'existing', food })}
                      >
                        <Panel>
                          <AppText>{food.name}</AppText>
                          <AppText variant="caption" tone="secondary">
                            {`${formatEnergy(food.kcal)} на 100 г`}
                          </AppText>
                        </Panel>
                      </Pressable>
                    ))}
                  </View>
                </>
              );
            }}
          </DataView>
        </>
      ) : (
        <>
          {mode.type === 'existing' ? (
            <Panel>
              <AppText variant="heading">{mode.food.name}</AppText>
              <AppText variant="callout" tone="secondary">
                {`На 100 г: ${formatEnergy(mode.food.kcal)}, ${formatMacros(mode.food)}`}
              </AppText>
            </Panel>
          ) : null}

          {creating ? (
            <Panel>
              <TextField label="Название" onChangeText={setName} value={name} />
              <TextField keyboardType="decimal-pad" label="Калории на 100 г" onChangeText={setKcalText} value={kcalText} />
              <TextField keyboardType="decimal-pad" label="Белки на 100 г" onChangeText={setProteinText} value={proteinText} />
              <TextField keyboardType="decimal-pad" label="Жиры на 100 г" onChangeText={setFatText} value={fatText} />
              <TextField keyboardType="decimal-pad" label="Углеводы на 100 г" onChangeText={setCarbsText} value={carbsText} />
              {areValidNutrients(typed) && energyLooksWrong(typed) ? (
                <AppText variant="callout" tone="warning">
                  Калории не сходятся с белками, жирами и углеводами. Проверьте значения.
                </AppText>
              ) : null}
            </Panel>
          ) : null}

          <TextField keyboardType="decimal-pad" label="Вес порции, г" onChangeText={setGramsText} value={gramsText} />

          {portion ? (
            <Panel>
              <AppText variant="heading">{formatEnergy(portion.kcal)}</AppText>
              <AppText variant="callout" tone="secondary">
                {formatMacros(portion)}
              </AppText>
            </Panel>
          ) : null}

          {error ? (
            <AppText accessibilityLiveRegion="polite" tone="danger">
              {error}
            </AppText>
          ) : null}
          <Button label="Записать" loading={saving} onPress={save} />
          <Button
            label="Другой продукт"
            variant="secondary"
            disabled={saving}
            onPress={() => {
              setError(null);
              setMode({ type: 'search' });
            }}
          />
        </>
      )}
    </Screen>
  );
}
