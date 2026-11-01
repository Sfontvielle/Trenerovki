import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { AppText, Button, Chip, ListGroup, ListRow, Panel, Screen, TextField, useTheme } from '@/design-system';
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
import { t } from '@/lib/i18n';

type Mode = { type: 'search' } | { type: 'existing'; food: PickedFood } | { type: 'new' };

const USUAL_FOODS = 3;
const USUAL_WINDOW_DAYS = 30;

type AddParams = {
  day: string;
  meal: Meal;
  barcode?: string;
  fromLookup?: string;
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
      setError(t('Укажите название продукта.'));
      return;
    }
    if (!areValidNutrients(per100g)) {
      setError(t('Заполните все поля на 100 г. Если значения нет, укажите 0. Калорий не больше 900, белков, жиров и углеводов вместе не больше 100 г.'));
      return;
    }
    if (!isValidGrams(grams)) {
      setError(t('Укажите вес порции от 1 до 5000 г.'));
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
      // After a scan the search form is still underneath this one.
      if (barcode && router.canDismiss()) {
        router.dismiss(2);
      } else {
        router.back();
      }
    } catch (cause) {
      console.error(cause);
      setError(t('Запись не сохранена. {0}', { 0: describeFailure(cause) }));
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
              <AppText variant="heading">{t('Обычно на {0}', { 0: mealLabels[meal].toLowerCase() })}</AppText>
              {usual.data.map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  caption={t('{0} г, {1}', { 0: formatInputNumber(food.grams), 1: formatEnergy(portionOf(food, food.grams).kcal) })}
                  onPick={(picked) => pick(picked, food.grams)}
                />
              ))}
            </View>
          ) : null}
          <FoodSearch onPick={(food) => pick(food)} />
          <ListGroup>
            <ListRow
              accessibilityLabel={t('Сканировать штрихкод')}
              icon={{ name: 'barcode.viewfinder', glyph: '▥', color: theme.colors.accent }}
              onPress={() => router.push({ pathname: '/food/scan', params: { day, meal } })}
              title={t('Сканировать штрихкод')}
            />
            <ListRow
              accessibilityLabel={t('Новый продукт')}
              icon={{ name: 'plus', glyph: '+', color: theme.colors.accent }}
              onPress={() => setMode({ type: 'new' })}
              title={t('Новый продукт')}
            />
            <ListRow
              accessibilityLabel={t('Блюдо из продуктов')}
              icon={{ name: 'fork.knife', glyph: '≡', color: theme.colors.accent }}
              onPress={() => router.push('/food/recipe')}
              title={t('Блюдо из продуктов')}
            />
          </ListGroup>
        </>
      ) : (
        <>
          {mode.type === 'existing' ? (
            <Panel>
              <AppText variant="heading">{mode.food.name}</AppText>
              <AppText variant="callout" tone="secondary">
                {t('На 100 г: {0}, {1}', { 0: formatEnergy(mode.food.kcal), 1: formatMacros(mode.food) })}
              </AppText>
              {mode.food.source === 'catalog' ? (
                <AppText variant="caption" tone="secondary">
                  {t('Типовые значения. У конкретного продукта они могут отличаться: сверяйте с упаковкой.')}
                </AppText>
              ) : null}
            </Panel>
          ) : null}

          {creating ? (
            <Panel>
              {params.fromLookup ? (
                <AppText variant="caption" tone="secondary">
                  {t('Значения из открытой базы Open Food Facts. Сверьте их с упаковкой перед записью.')}
                </AppText>
              ) : null}
              <TextField label={t('Название')} onChangeText={setName} value={name} />
              <TextField keyboardType="decimal-pad" label={t('Калории на 100 г')} onChangeText={setKcalText} value={kcalText} />
              <TextField keyboardType="decimal-pad" label={t('Белки на 100 г')} onChangeText={setProteinText} value={proteinText} />
              <TextField keyboardType="decimal-pad" label={t('Жиры на 100 г')} onChangeText={setFatText} value={fatText} />
              <TextField keyboardType="decimal-pad" label={t('Углеводы на 100 г')} onChangeText={setCarbsText} value={carbsText} />
              {areValidNutrients(typed) && energyLooksWrong(typed) ? (
                <AppText variant="callout" tone="warning">
                  {t('Калории не сходятся с белками, жирами и углеводами. Проверьте значения.')}
                </AppText>
              ) : null}
            </Panel>
          ) : null}

          <TextField keyboardType="decimal-pad" label={t('Вес порции, г')} onChangeText={setGramsText} value={gramsText} />
          {mode.type === 'existing' && mode.food.portion ? (
            <View style={{ flexDirection: 'row' }}>
              <Chip
                label={t('{0}, {1} г', { 0: mode.food.portion.label, 1: mode.food.portion.grams })}
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
          <Button label={t('Записать')} loading={saving} onPress={save} />
          <Button
            label={t('Другой продукт')}
            variant="plain"
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
