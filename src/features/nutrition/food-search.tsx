import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Panel, TextField, useTheme } from '@/design-system';
import { type CatalogFood, foodCatalog } from '@/domains/nutrition/food-catalog';
import type { Food } from '@/domains/nutrition/nutrition';
import { listFoods } from '@/domains/nutrition/nutrition-repository';
import type { Diet } from '@/domains/profile/profile';
import { formatEnergy } from '@/features/nutrition/format-nutrition';
import { normalizeSearch } from '@/lib/format';
import { t } from '@/lib/i18n';

const CATALOG_RESULTS = 20;

export type PickedFood = Food & {
  portion?: { label: string; grams: number };
};

const hiddenGroups: Record<Diet, CatalogFood['group'][]> = {
  any: [],
  vegetarian: ['fish', 'meat'],
  vegan: ['fish', 'meat', 'dairy', 'egg', 'bee'],
};

function toPicked({ id, name, kcal, protein, fat, carbs, portion }: CatalogFood): PickedFood {
  return { id, name, kcal, protein, fat, carbs, source: 'catalog', portion };
}

type FoodRowProps = {
  food: PickedFood;
  caption: string;
  onPick: (food: PickedFood) => void;
};

export function FoodRow({ food, caption, onPick }: FoodRowProps) {
  return (
    <Pressable accessibilityRole="button" onPress={() => onPick(food)}>
      <Panel>
        <AppText>{food.name}</AppText>
        <AppText variant="caption" tone="secondary">
          {caption}
        </AppText>
      </Panel>
    </Pressable>
  );
}

type FoodSearchProps = {
  onPick: (food: PickedFood) => void;
};

export function FoodSearch({ onPick }: FoodSearchProps) {
  const { database, profile } = useAppData();
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const load = useCallback(() => listFoods(database), [database]);
  const state = useScreenData(load);
  const hidden = hiddenGroups[profile?.diet ?? 'any'];

  return (
    <>
      <TextField label={t('Найти продукт')} onChangeText={setQuery} value={query} />
      <DataView state={state}>
        {(own) => {
          const normalized = normalizeSearch(query);
          const ownMatches = own.filter((food) => normalizeSearch(food.name).includes(normalized));
          const ownNames = new Set(own.map((food) => normalizeSearch(food.name)));
          const catalogMatches = normalized
            ? foodCatalog
                .filter(
                  (food) =>
                    !hidden.includes(food.group) &&
                    normalizeSearch(food.name).includes(normalized) &&
                    !ownNames.has(normalizeSearch(food.name)),
                )
                .slice(0, CATALOG_RESULTS)
            : [];

          return (
            <View style={{ gap: theme.spacing.s }}>
              {!normalized && own.length === 0 ? (
                <AppText tone="secondary">
                  {t('Введите название, чтобы найти продукт в базе. Здесь появятся продукты, которые вы уже записывали.')}
                </AppText>
              ) : null}
              {normalized && ownMatches.length === 0 && catalogMatches.length === 0 ? (
                <AppText tone="secondary">{t('Ничего не найдено. Добавьте новый продукт.')}</AppText>
              ) : null}
              {ownMatches.map((food) => (
                <FoodRow key={food.id} food={food} caption={t('{0} на 100 г', { 0: formatEnergy(food.kcal) })} onPick={onPick} />
              ))}
              {catalogMatches.map((food) => (
                <FoodRow
                  key={food.id}
                  food={toPicked(food)}
                  caption={t('{0} на 100 г, типовые значения', { 0: formatEnergy(food.kcal) })}
                  onPick={onPick}
                />
              ))}
            </View>
          );
        }}
      </DataView>
    </>
  );
}
