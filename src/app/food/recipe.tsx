import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, Panel, Screen, TextField } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { isValidGrams, portionOf, sumNutrients } from '@/domains/nutrition/nutrition';
import { type RecipeItem, saveRecipe } from '@/domains/nutrition/nutrition-repository';
import { FoodSearch, type PickedFood } from '@/features/nutrition/food-search';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { describeFailure } from '@/lib/describe-failure';
import { formatNumber, parseDecimal } from '@/lib/format';

export default function NewRecipeScreen() {
  const { database } = useAppData();
  const [name, setName] = useState('');
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [picked, setPicked] = useState<PickedFood | null>(null);
  const [gramsText, setGramsText] = useState('');
  const [totalText, setTotalText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ingredientsGrams = items.reduce((total, item) => total + item.grams, 0);
  const typedTotal = parseDecimal(totalText);
  const totalGrams = typedTotal ?? ingredientsGrams;
  const totals = sumNutrients(items);

  const addItem = () => {
    const grams = parseDecimal(gramsText);
    if (!picked || !isValidGrams(grams)) {
      setError('Укажите вес продукта от 1 до 5000 г.');
      return;
    }
    setItems((current) => [
      ...current,
      { id: createId(), name: picked.name, grams, ...portionOf(picked, grams) },
    ]);
    setPicked(null);
    setGramsText('');
    setError(null);
  };

  const save = async () => {
    if (!name.trim() || items.length === 0) {
      setError('Укажите название и добавьте хотя бы один продукт.');
      return;
    }
    if (!isValidGrams(totalGrams)) {
      setError('Укажите вес готового блюда от 1 до 5000 г.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRecipe(database, { id: createId(), name, items, totalGrams }, new Date());
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Блюдо не сохранено. ${describeFailure(cause)}`);
      setSaving(false);
    }
  };

  return (
    <Screen scroll belowHeader>
      <TextField label="Название блюда" maxLength={60} onChangeText={setName} value={name} />

      {items.length > 0 ? (
        <Panel>
          <AppText variant="heading">Состав</AppText>
          {items.map((item) => (
            <AppText key={item.id} variant="callout" tone="secondary">
              {`${item.name}: ${formatNumber(item.grams)} г`}
            </AppText>
          ))}
          <AppText variant="callout" tone="secondary">
            {`Всего: ${formatEnergy(totals.kcal)}, ${formatMacros(totals)}`}
          </AppText>
          <Button label="Убрать последний продукт" variant="secondary" onPress={() => setItems(items.slice(0, -1))} />
        </Panel>
      ) : null}

      {picked ? (
        <Panel>
          <AppText variant="heading">{picked.name}</AppText>
          <TextField keyboardType="decimal-pad" label="Вес продукта, г" onChangeText={setGramsText} value={gramsText} />
          <Button label="Добавить в блюдо" variant="secondary" onPress={addItem} />
          <Button label="Другой продукт" variant="secondary" onPress={() => setPicked(null)} />
        </Panel>
      ) : (
        <FoodSearch onPick={setPicked} />
      )}

      {items.length > 0 ? (
        <TextField
          hint="Необязательно. Если не указать, считаем по сумме продуктов"
          keyboardType="decimal-pad"
          label="Вес готового блюда, г"
          onChangeText={setTotalText}
          value={totalText}
        />
      ) : null}

      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button label="Сохранить блюдо" loading={saving} onPress={save} />
    </Screen>
  );
}
