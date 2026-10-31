import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, Panel, Screen, TextField } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { areValidNutrients, isValidGrams, portionOf, sumNutrients } from '@/domains/nutrition/nutrition';
import { type RecipeItem, saveRecipe } from '@/domains/nutrition/nutrition-repository';
import { FoodSearch, type PickedFood } from '@/features/nutrition/food-search';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { describeFailure } from '@/lib/describe-failure';
import { formatNumber, parseDecimal } from '@/lib/format';
import { t } from '@/lib/i18n';

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
      setError(t('Укажите вес продукта от 1 до 5000 г.'));
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
      setError(t('Укажите название и добавьте хотя бы один продукт.'));
      return;
    }
    if (!isValidGrams(totalGrams)) {
      setError(t('Укажите вес готового блюда от 1 до 5000 г.'));
      return;
    }
    if (!areValidNutrients(portionOf(totals, (100 * 100) / totalGrams))) {
      setError(t('Проверьте вес готового блюда: для такого состава он слишком мал.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveRecipe(database, { id: createId(), name, items, totalGrams }, new Date());
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(t('Блюдо не сохранено. {0}', { 0: describeFailure(cause) }));
      setSaving(false);
    }
  };

  return (
    <Screen scroll belowHeader>
      <TextField label={t('Название блюда')} maxLength={60} onChangeText={setName} value={name} />

      {items.length > 0 ? (
        <Panel>
          <AppText variant="heading">{t('Состав')}</AppText>
          {items.map((item) => (
            <AppText key={item.id} variant="callout" tone="secondary">
              {t('{0}: {1} г', { 0: item.name, 1: formatNumber(item.grams) })}
            </AppText>
          ))}
          <AppText variant="callout" tone="secondary">
            {t('Всего: {0}, {1}', { 0: formatEnergy(totals.kcal), 1: formatMacros(totals) })}
          </AppText>
          <Button label={t('Убрать последний продукт')} variant="secondary" onPress={() => setItems(items.slice(0, -1))} />
        </Panel>
      ) : null}

      {picked ? (
        <Panel>
          <AppText variant="heading">{picked.name}</AppText>
          <TextField keyboardType="decimal-pad" label={t('Вес продукта, г')} onChangeText={setGramsText} value={gramsText} />
          <Button label={t('Добавить в блюдо')} variant="secondary" onPress={addItem} />
          <Button label={t('Другой продукт')} variant="secondary" onPress={() => setPicked(null)} />
        </Panel>
      ) : (
        <FoodSearch onPick={setPicked} />
      )}

      {items.length > 0 ? (
        <TextField
          hint={t('Необязательно. Если не указать, считаем по сумме продуктов')}
          keyboardType="decimal-pad"
          label={t('Вес готового блюда, г')}
          onChangeText={setTotalText}
          value={totalText}
        />
      ) : null}

      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button label={t('Сохранить блюдо')} loading={saving} onPress={save} />
    </Screen>
  );
}
