import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel, useTheme } from '@/design-system';
import {
  dayKey,
  mealLabels,
  meals,
  shiftDay,
  sumNutrients,
} from '@/domains/nutrition/nutrition';
import { listDayEntries } from '@/domains/nutrition/nutrition-repository';
import { formatDayLabel, formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { formatNumber } from '@/lib/format';

export default function NutritionScreen() {
  const { database } = useAppData();
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;
  const today = dayKey(new Date());
  const [day, setDay] = useState(today);

  const load = useCallback(() => listDayEntries(database, day), [database, day]);
  const state = useScreenData(load);

  const dayButton = (label: string, name: string, target: string, disabled: boolean) => (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setDay(target)}
      style={[
        styles.dayButton,
        {
          backgroundColor: colors.surface,
          borderRadius: radii.full,
          height: sizes.minTouch,
          opacity: disabled ? 0.4 : 1,
          width: sizes.minTouch,
        },
      ]}
    >
      <AppText variant="heading">{label}</AppText>
    </Pressable>
  );

  return (
    <TabScreen title="Питание">
      <View style={[styles.dayRow, { gap: spacing.m }]}>
        {dayButton('‹', 'Предыдущий день', shiftDay(day, -1), false)}
        <AppText accessibilityLiveRegion="polite" variant="heading" style={styles.dayLabel}>
          {formatDayLabel(day, new Date())}
        </AppText>
        {dayButton('›', 'Следующий день', shiftDay(day, 1), day >= today)}
      </View>

      <DataView state={state}>
        {(entries) => {
          const totals = sumNutrients(entries);

          return (
            <>
              <Panel>
                <AppText variant="display">{formatEnergy(totals.kcal)}</AppText>
                <AppText tone="secondary">{formatMacros(totals)}</AppText>
              </Panel>

              {meals.map((meal) => {
                const mealEntries = entries.filter((entry) => entry.meal === meal);
                const mealTotal = sumNutrients(mealEntries);

                return (
                  <Panel key={meal}>
                    <View style={styles.mealHeader}>
                      <AppText variant="heading">{mealLabels[meal]}</AppText>
                      {mealEntries.length > 0 ? (
                        <AppText variant="callout" tone="secondary">
                          {formatEnergy(mealTotal.kcal)}
                        </AppText>
                      ) : null}
                    </View>
                    {mealEntries.map((entry) => (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="button"
                        onPress={() => router.push(`/food/${entry.id}`)}
                        style={[styles.entry, { minHeight: sizes.minTouch }]}
                      >
                        <AppText>{entry.name}</AppText>
                        <AppText variant="callout" tone="secondary">
                          {`${formatNumber(entry.grams)} г, ${formatEnergy(entry.kcal)}`}
                        </AppText>
                      </Pressable>
                    ))}
                    <Button
                      accessibilityLabel={`Добавить: ${mealLabels[meal]}`}
                      label="Добавить"
                      variant="secondary"
                      onPress={() =>
                        router.push({ pathname: '/food/add', params: { day, meal } })
                      }
                    />
                  </Panel>
                );
              })}

              <AppText variant="caption" tone="secondary">
                Продукты вы вносите сами. Готовой базы продуктов и норм КБЖУ пока нет.
              </AppText>
            </>
          );
        }}
      </DataView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  dayButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  dayRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  entry: {
    justifyContent: 'center',
  },
  mealHeader: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
