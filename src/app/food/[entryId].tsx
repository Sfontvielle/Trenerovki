import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, TextField } from '@/design-system';
import { type FoodEntry, isValidGrams, mealLabels } from '@/domains/nutrition/nutrition';
import { changeEntryGrams, deleteEntry, getEntry } from '@/domains/nutrition/nutrition-repository';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, parseDecimal } from '@/lib/format';
import { t } from '@/lib/i18n';

function EntryForm({ entry }: { entry: FoodEntry }) {
  const { database } = useAppData();
  const [gramsText, setGramsText] = useState(formatInputNumber(entry.grams));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const grams = parseDecimal(gramsText);
    if (!isValidGrams(grams)) {
      setError(t('Укажите вес порции от 1 до 5000 г.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await changeEntryGrams(database, entry, grams);
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(t('Изменения не сохранены. {0}', { 0: describeFailure(cause) }));
      setSaving(false);
    }
  };

  const remove = async () => {
    const approved = await confirm({
      title: t('Удалить запись?'),
      message: entry.name,
      confirmLabel: t('Удалить'),
      destructive: true,
    });
    if (!approved) {
      return;
    }
    setError(null);
    try {
      await deleteEntry(database, entry.id);
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(t('Запись не удалена. {0}', { 0: describeFailure(cause) }));
    }
  };

  return (
    <>
      <Panel>
        <AppText accessibilityRole="header" variant="title">
          {entry.name}
        </AppText>
        <AppText variant="callout" tone="secondary">
          {mealLabels[entry.meal]}
        </AppText>
        <AppText tone="secondary">{`${formatEnergy(entry.kcal)}, ${formatMacros(entry)}`}</AppText>
      </Panel>
      <TextField keyboardType="decimal-pad" label={t('Вес порции, г')} onChangeText={setGramsText} value={gramsText} />
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button label={t('Сохранить')} loading={saving} onPress={save} />
      <Button label={t('Удалить запись')} variant="secondary" disabled={saving} onPress={remove} />
    </>
  );
}

export default function FoodEntryScreen() {
  const { entryId } = useLocalSearchParams<{ entryId: string }>();
  const { database } = useAppData();
  const load = useCallback(() => getEntry(database, entryId), [database, entryId]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(entry) =>
          entry ? (
            <EntryForm key={entry.id} entry={entry} />
          ) : (
            <Panel>
              <AppText variant="heading">{t('Запись не найдена')}</AppText>
              <Button label={t('Назад')} variant="secondary" onPress={() => router.back()} />
            </Panel>
          )
        }
      </DataView>
    </Screen>
  );
}
