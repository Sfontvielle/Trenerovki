import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { AppText, Button, Chip, Panel, Screen, TextField, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import {
  type FoodSource,
  type Meal,
  type Nutrients,
  areValidNutrients,
  energyLooksWrong,
  isValidGrams,
  mealLabels,
  portionOf,
  shiftDay,
} from '@/domains/nutrition/nutrition';
import { listUsualFoods, logFood } from '@/domains/nutrition/nutrition-repository';
import { FoodRow, FoodSearch, type PickedFood } from '@/features/nutrition/food-search';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, parseDecimal } from '@/lib/format';

type Mode = { type: 'search' } | { type: 'existing'; food: PickedFood } | { type: 'new' };

const USUAL_FOODS = 3;
const USUAL_WINDOW_DAYS = 30;

type AddParams = {
  day: string;
  meal: Meal;
  barcode?: string;
  name?: string;
  kcal?: string;
  protein?: string;
  fat?: string;
  carbs?: string;
};

export default function AddFoodScreen() {
  const params = useLocalSearchParams<AddParams>();
  const { day, meal, barcode } = params;
  const { database } = useAppData();
  const { theme } = useTheme();
  const { spacing } = theme;
  const [mode, setMode] = useState<Mode>(barcode ? { type: 'new' } : { type: 'search' });
  const [name, setName] = useState(params.name ?? '');
  const [kcalText, setKcalText] = useState(formatInputNumber(params.kcal ? Number(params.kcal) : null));
  const [proteinText, setProteinText] = useState(formatInputNumber(params.protein ? Number(params.protein) : null));
  const [fatText, setFatText] = useState(formatInputNumber(params.fat ? Number(params.fat) : null));
  const [carbsText, setCarbsText] = useState(formatInputNumber(params.carbs ? Number(params.carbs) : null));
  const [gramsText, setGramsText] = useState('');
  const [entryId] = useState(createId);
  const [newFoodId] = useState(createId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () => listUsualFoods(database, meal, shiftDay(day, -USUAL_WINDOW_DAYS), USUAL_FOODS),
    [database, day, meal],
  );
  const usual = useScreenData(load);

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
  const source: FoodSource = mode.type === 'existing' ? mode.food.source : barcode ? 'barcode' : 'user';

  const pick = (food: PickedFood, usualGrams?: number) => {
    setMode({ type: 'existing', food });
    setGramsText(usualGrams ? formatInputNumber(usualGrams) : '');
  };

  const save = async () => {
    const foodName = mode.type === 'existing' ? mode.food.name : name;
    if (!foodName.trim()) {
      setError('Укажите название продукта.');
      return;
    }
    if (!areValidNutrients(per100g)) {
      setError('Заполните все поля на 100 г. Если значения нет, укажите 0. Калорий не больше 900, белков, жиров и углеводов вместе не больше 100 г.');
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
        source,
        barcode: mode.type === 'new' ? (barcode ?? null) : null,
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
          {usual.status === 'ready' && usual.data.length > 0 ? (
            <View style={{ gap: spacing.s }}>
              <AppText variant="heading">{`Обычно на ${mealLabels[meal].toLowerCase()}`}</AppText>
              {usual.data.map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  caption={`${formatInputNumber(food.grams)} г, ${formatEnergy(portionOf(food, food.grams).kcal)}`}
                  onPick={(picked) => pick(picked, food.grams)}
                />
              ))}
            </View>
          ) : null}
          <FoodSearch onPick={(food) => pick(food)} />
          <Button label="Новый продукт" variant="secondary" onPress={() => setMode({ type: 'new' })} />
          <Button
            label="Сканировать штрихкод"
            variant="secondary"
            onPress={() => router.push({ pathname: '/food/scan', params: { day, meal } })}
          />
          <Button label="Блюдо из продуктов" variant="secondary" onPress={() => router.push('/food/recipe')} />
        </>
      ) : (
        <>
          {mode.type === 'existing' ? (
            <Panel>
              <AppText variant="heading">{mode.food.name}</AppText>
              <AppText variant="callout" tone="secondary">
                {`На 100 г: ${formatEnergy(mode.food.kcal)}, ${formatMacros(mode.food)}`}
              </AppText>
              {mode.food.source === 'catalog' ? (
                <AppText variant="caption" tone="secondary">
                  Типовые значения. У конкретного продукта они могут отличаться: сверяйте с упаковкой.
                </AppText>
              ) : null}
            </Panel>
          ) : null}

          {creating ? (
            <Panel>
              {barcode ? (
                <AppText variant="caption" tone="secondary">
                  Значения из открытой базы Open Food Facts. Сверьте их с упаковкой перед записью.
                </AppText>
              ) : null}
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
          {mode.type === 'existing' && mode.food.portion ? (
            <View style={{ flexDirection: 'row' }}>
              <Chip
                label={`${mode.food.portion.label}, ${mode.food.portion.grams} г`}
                selected={grams === mode.food.portion.grams}
                onPress={() => setGramsText(String(mode.type === 'existing' ? mode.food.portion?.grams : ''))}
              />
            </View>
          ) : null}

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
