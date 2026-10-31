import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { useToday } from '@/app-data/use-today';
import { RulerPicker } from '@/components/ruler-picker';
import { DataView } from '@/components/states';
import { TrendBars } from '@/components/trend-bars';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import {
  type BodyWeightEntry,
  deleteBodyWeight,
  listBodyWeight,
  saveBodyWeight,
} from '@/domains/body/body-weight-repository';
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG, isValidWeight } from '@/domains/profile/profile';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatDate, formatWeight } from '@/lib/format';
import { t } from '@/lib/i18n';

const WEIGHT_STEP_KG = 0.1;
const DEFAULT_WEIGHT_KG = 75;

function dayLabel(entry: BodyWeightEntry) {
  return `${formatDate(`${entry.day}T12:00:00`)}: ${formatWeight(entry.weightKg)}`;
}

type WeightFormProps = {
  entries: BodyWeightEntry[];
  onChanged: () => void;
};

function WeightForm({ entries, onChanged }: WeightFormProps) {
  const { database, profile } = useAppData();
  const { theme } = useTheme();
  const today = useToday();
  const todayEntry = entries.find((entry) => entry.day === today);
  const start = entries.at(-1)?.weightKg ?? profile?.weightKg ?? DEFAULT_WEIGHT_KG;
  const [value, setValue] = useState<number | null>(todayEntry?.weightKg ?? null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const valueError =
    value !== null && !isValidWeight(value) ? t('Укажите вес от {0} до {1} кг', { 0: MIN_WEIGHT_KG, 1: MAX_WEIGHT_KG }) : null;

  const run = async (action: () => Promise<void>, failure: string) => {
    setSaving(true);
    setMessage(null);
    try {
      await action();
      onChanged();
    } catch (cause) {
      console.error(cause);
      setMessage(`${failure} ${describeFailure(cause)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <RulerPicker
        label={t('Вес тела')}
        max={MAX_WEIGHT_KG}
        min={MIN_WEIGHT_KG}
        onChange={setValue}
        start={start}
        step={WEIGHT_STEP_KG}
        unit={t('кг')}
        value={value}
      />
      {valueError ?? message ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {valueError ?? message}
        </AppText>
      ) : null}
      <Button
        disabled={value === null || valueError !== null}
        label={todayEntry ? t('Обновить вес за сегодня') : t('Записать вес')}
        loading={saving}
        onPress={() =>
          run(() => saveBodyWeight(database, today, value as number, new Date()), t('Вес не сохранён.'))
        }
      />
      {todayEntry ? (
        <Button
          disabled={saving}
          label={t('Удалить запись за сегодня')}
          variant="secondary"
          onPress={async () => {
            const approved = await confirm({
              title: t('Удалить запись за сегодня?'),
              message: formatWeight(todayEntry.weightKg),
              confirmLabel: t('Удалить'),
              destructive: true,
            });
            if (approved) {
              await run(() => deleteBodyWeight(database, today), t('Запись не удалена.'));
            }
          }}
        />
      ) : null}

      {entries.length > 0 ? (
        <Panel>
          <AppText variant="heading">{t('Динамика')}</AppText>
          <TrendBars
            bars={entries.map((entry) => ({ key: entry.day, value: entry.weightKg, label: dayLabel(entry) }))}
          />
        </Panel>
      ) : null}
      <View style={{ gap: theme.spacing.xs }}>
        {[...entries].reverse().map((entry) => (
          <AppText key={entry.day} variant="callout" tone="secondary">
            {dayLabel(entry)}
          </AppText>
        ))}
      </View>
    </>
  );
}

export default function BodyWeightScreen() {
  const { database } = useAppData();
  const load = useCallback(() => listBodyWeight(database), [database]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(entries) => <WeightForm entries={entries} onChanged={state.reload} />}
      </DataView>
    </Screen>
  );
}
