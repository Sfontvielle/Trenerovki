import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { useToday } from '@/app-data/use-today';
import { ProgressLine } from '@/components/progress-line';
import { DataView } from '@/components/states';
import { TabScreen } from '@/components/tab-screen';
import { AppText, Button, IconButton, ListGroup, ListRow, Panel, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { type Nutrients, mealLabels, meals, shiftDay, sumNutrients } from '@/domains/nutrition/nutrition';
import { copyDay, getManualTarget, listDayEntries } from '@/domains/nutrition/nutrition-repository';
import { dayTarget } from '@/domains/nutrition/targets';
import { formatDayLabel, formatEnergy } from '@/features/nutrition/format-nutrition';
import { SessionBar } from '@/features/workout/session-bar';
import { describeFailure } from '@/lib/describe-failure';
import { formatNumber } from '@/lib/format';
import { t } from '@/lib/i18n';

type MacroProps = {
  label: string;
  eaten: number;
  target: number | null;
};

function Macro({ label, eaten, target }: MacroProps) {
  const { theme } = useTheme();
  const value = target
    ? t('{0} из {1} г', { 0: Math.round(eaten), 1: Math.round(target) })
    : t('{0} г', { 0: Math.round(eaten) });

  return (
    <View accessibilityLabel={`${label}: ${value}`} accessible style={[styles.macro, { gap: theme.spacing.xs }]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="scoreSmall">{value}</AppText>
      {target ? <ProgressLine label={label} ratio={eaten / target} /> : null}
    </View>
  );
}

type DaySummaryProps = {
  totals: Nutrients;
  target: Nutrients | null;
  mode: 'targets' | 'protein' | 'diary';
};

function DaySummary({ totals, target, mode }: DaySummaryProps) {
  const { theme } = useTheme();
  const measured = mode === 'targets' ? target : null;
  const remaining = measured ? measured.kcal - totals.kcal : null;

  return (
    <Panel>
      {remaining !== null && measured ? (
        <>
          <View>
            <AppText variant="scoreHero" tone={remaining < 0 ? 'warning' : 'primary'}>
              {formatNumber(Math.abs(Math.round(remaining)))}
            </AppText>
            <AppText variant="callout" tone="secondary">
              {remaining < 0
                ? t('ккал сверх цели, съедено {0}', { 0: formatEnergy(totals.kcal) })
                : t('ккал осталось, съедено {0}', { 0: formatEnergy(totals.kcal) })}
            </AppText>
          </View>
          <ProgressLine label={t('Калории за день')} ratio={totals.kcal / measured.kcal} />
        </>
      ) : (
        <View>
          <AppText variant="scoreHero">{formatNumber(Math.round(totals.kcal))}</AppText>
          <AppText variant="callout" tone="secondary">
            {t('ккал за день')}
          </AppText>
        </View>
      )}
      <View style={[styles.macros, { gap: theme.spacing.m }]}>
        <Macro eaten={totals.protein} label={t('Белок')} target={target?.protein ?? null} />
        <Macro eaten={totals.fat} label={t('Жиры')} target={measured?.fat ?? null} />
        <Macro eaten={totals.carbs} label={t('Углеводы')} target={measured?.carbs ?? null} />
      </View>
    </Panel>
  );
}

export default function NutritionScreen() {
  const { database, profile } = useAppData();
  const { theme } = useTheme();
  const { spacing } = theme;
  const today = useToday();
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay ?? today;
  const mode = profile?.nutritionMode ?? 'targets';
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const load = useCallback(async () => {
    const [entries, manual, previous] = await Promise.all([
      listDayEntries(database, day),
      getManualTarget(database),
      listDayEntries(database, shiftDay(day, -1)),
    ]);
    return {
      entries,
      target: dayTarget(profile, manual),
      canCopy: entries.length === 0 && previous.length > 0,
    };
  }, [database, day, profile]);
  const state = useScreenData(load);

  const copyPrevious = async () => {
    setCopyError(null);
    setCopying(true);
    try {
      await copyDay(database, shiftDay(day, -1), day, createId, new Date());
      state.reload();
    } catch (cause) {
      console.error(cause);
      setCopyError(t('Записи не скопированы. {0}', { 0: describeFailure(cause) }));
    } finally {
      setCopying(false);
    }
  };

  const openDay = (target: string) => setPickedDay(target === today ? null : target);

  return (
    <TabScreen title={t('Питание')}>
      <SessionBar />
      <View style={[styles.dayRow, { gap: spacing.m }]}>
        <IconButton glyph="‹" label={t('Предыдущий день')} name="chevron.left" onPress={() => openDay(shiftDay(day, -1))} />
        <AppText accessibilityLiveRegion="polite" variant="heading" style={styles.dayLabel}>
          {formatDayLabel(day, today)}
        </AppText>
        <IconButton
          disabled={day >= today}
          glyph="›"
          label={t('Следующий день')}
          name="chevron.right"
          onPress={() => openDay(shiftDay(day, 1))}
        />
      </View>

      <DataView state={state}>
        {({ entries, target, canCopy }) => (
          <>
            <DaySummary mode={mode} target={target} totals={sumNutrients(entries)} />

            {canCopy ? (
              <Button
                label={t('Скопировать записи предыдущего дня')}
                variant="secondary"
                loading={copying}
                onPress={copyPrevious}
              />
            ) : null}
            {copyError ? (
              <AppText accessibilityLiveRegion="polite" tone="danger">
                {copyError}
              </AppText>
            ) : null}

            {meals.map((meal) => {
              const mealEntries = entries.filter((entry) => entry.meal === meal);

              return (
                <ListGroup
                  key={meal}
                  title={mealLabels[meal]}
                  action={
                    <>
                      {mealEntries.length > 0 ? (
                        <AppText variant="callout" tone="secondary">
                          {formatEnergy(sumNutrients(mealEntries).kcal)}
                        </AppText>
                      ) : null}
                      <IconButton
                        color={theme.colors.accent}
                        glyph="+"
                        label={t('Добавить: {0}', { 0: mealLabels[meal] })}
                        name="plus"
                        onPress={() => router.push({ pathname: '/food/add', params: { day, meal } })}
                      />
                    </>
                  }
                >
                  {mealEntries.map((entry) => (
                    <ListRow
                      key={entry.id}
                      onPress={() => router.push(`/food/${entry.id}`)}
                      subtitle={t('{0} г, {1}', { 0: formatNumber(entry.grams), 1: formatEnergy(entry.kcal) })}
                      title={entry.name}
                    />
                  ))}
                </ListGroup>
              );
            })}

            {mode === 'diary' ? null : (
              <Button label={t('Цели по питанию')} variant="plain" onPress={() => router.push('/nutrition-targets')} />
            )}

            <AppText variant="caption" tone="secondary">
              {t('Значения в базе типовые, а данные штрихкодов взяты из открытой базы Open Food Facts. Сверяйте их с упаковкой.')}
            </AppText>
          </>
        )}
      </DataView>
    </TabScreen>
  );
}

const styles = StyleSheet.create({
  dayLabel: {
    flex: 1,
    textAlign: 'center',
  },
  dayRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  macro: {
    flex: 1,
  },
  macros: {
    flexDirection: 'row',
  },
});
