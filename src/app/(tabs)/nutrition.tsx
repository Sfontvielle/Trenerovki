import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { useToday } from '@/app-data/use-today';
import { ProgressLine } from '@/components/progress-line';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, Panel, useTheme } from '@/design-system';
import {
  mealLabels,
  meals,
  shiftDay,
  sumNutrients,
} from '@/domains/nutrition/nutrition';
import { copyDay, getManualTarget, listDayEntries } from '@/domains/nutrition/nutrition-repository';
import { estimateTargets } from '@/domains/nutrition/targets';
import { createId } from '@/domains/data-platform/ids';
import { formatDayLabel, formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { SessionBar } from '@/features/workout/session-bar';
import { describeFailure } from '@/lib/describe-failure';
import { formatNumber } from '@/lib/format';

export default function NutritionScreen() {
  const { database, profile } = useAppData();
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;
  const today = useToday();
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay ?? today;

  const mode = profile?.nutritionMode ?? 'targets';
  const [copyError, setCopyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [entries, manual, previous] = await Promise.all([
      listDayEntries(database, day),
      getManualTarget(database),
      listDayEntries(database, shiftDay(day, -1)),
    ]);
    return {
      entries,
      target: mode === 'diary' ? null : (manual ?? (profile ? estimateTargets(profile) : null)),
      canCopy: entries.length === 0 && previous.length > 0,
    };
  }, [database, day, mode, profile]);
  const state = useScreenData(load);

  const copyPrevious = async () => {
    setCopyError(null);
    try {
      await copyDay(database, shiftDay(day, -1), day, createId, new Date());
      state.reload();
    } catch (cause) {
      console.error(cause);
      setCopyError(`Записи не скопированы. ${describeFailure(cause)}`);
    }
  };

  const dayButton = (label: string, name: string, target: string, disabled: boolean) => (
    <Pressable
      accessibilityLabel={name}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => setPickedDay(target === today ? null : target)}
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
      <SessionBar />
      <View style={[styles.dayRow, { gap: spacing.m }]}>
        {dayButton('‹', 'Предыдущий день', shiftDay(day, -1), false)}
        <AppText accessibilityLiveRegion="polite" variant="heading" style={styles.dayLabel}>
          {formatDayLabel(day, today)}
        </AppText>
        {dayButton('›', 'Следующий день', shiftDay(day, 1), day >= today)}
      </View>

      <DataView state={state}>
        {({ entries, target, canCopy }) => {
          const totals = sumNutrients(entries);

          return (
            <>
              <Panel>
                <AppText variant="display">{formatEnergy(totals.kcal)}</AppText>
                <AppText tone="secondary">{formatMacros(totals)}</AppText>
                {target && mode === 'targets' ? (
                  <>
                    <ProgressLine label="Калории за день" ratio={totals.kcal / target.kcal} />
                    <AppText variant="callout" tone="secondary">
                      {`Цель: ${formatEnergy(target.kcal)}, ${formatMacros(target)}`}
                    </AppText>
                  </>
                ) : null}
                {target && mode === 'protein' ? (
                  <>
                    <ProgressLine label="Белок за день" ratio={totals.protein / target.protein} />
                    <AppText variant="callout" tone="secondary">
                      {`Белок: ${Math.round(totals.protein)} из ${Math.round(target.protein)} г`}
                    </AppText>
                  </>
                ) : null}
                {mode === 'diary' ? null : (
                  <Button
                    label="Цели по питанию"
                    variant="secondary"
                    onPress={() => router.push('/nutrition-targets')}
                  />
                )}
              </Panel>

              {canCopy ? (
                <Button label="Скопировать записи предыдущего дня" variant="secondary" onPress={copyPrevious} />
              ) : null}
              {copyError ? (
                <AppText accessibilityLiveRegion="polite" tone="danger">
                  {copyError}
                </AppText>
              ) : null}

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
                Значения в базе типовые, а данные штрихкодов взяты из открытой базы Open Food Facts. Сверяйте их с упаковкой.
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
