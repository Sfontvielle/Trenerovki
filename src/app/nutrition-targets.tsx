import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, TextField } from '@/design-system';
import type { Nutrients } from '@/domains/nutrition/nutrition';
import { clearManualTarget, getManualTarget, saveManualTarget } from '@/domains/nutrition/nutrition-repository';
import { estimateTargets } from '@/domains/nutrition/targets';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, parseDecimal } from '@/lib/format';

const MAX_DAILY_KCAL = 10000;
const MAX_DAILY_GRAMS = 1000;

type TargetsFormProps = {
  manual: Nutrients | null;
  estimate: Nutrients | null;
};

function TargetsForm({ manual, estimate }: TargetsFormProps) {
  const { database } = useAppData();
  const start = manual ?? estimate;
  const [kcalText, setKcalText] = useState(formatInputNumber(start?.kcal));
  const [proteinText, setProteinText] = useState(formatInputNumber(start?.protein));
  const [fatText, setFatText] = useState(formatInputNumber(start?.fat));
  const [carbsText, setCarbsText] = useState(formatInputNumber(start?.carbs));
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Цели не сохранены. ${describeFailure(cause)}`);
    }
  };

  const save = () => {
    const target = {
      kcal: parseDecimal(kcalText),
      protein: parseDecimal(proteinText),
      fat: parseDecimal(fatText),
      carbs: parseDecimal(carbsText),
    };
    const valid =
      target.kcal !== null &&
      target.kcal > 0 &&
      target.kcal <= MAX_DAILY_KCAL &&
      [target.protein, target.fat, target.carbs].every(
        (value) => value !== null && Number.isFinite(value) && value <= MAX_DAILY_GRAMS,
      );
    if (!valid) {
      setError('Заполните все поля числами: калории до 10000, остальное до 1000 г.');
      return;
    }
    run(() => saveManualTarget(database, target as Nutrients, new Date()));
  };

  return (
    <>
      {estimate ? (
        <Panel>
          <AppText variant="heading">Расчёт по вашим ответам</AppText>
          <AppText tone="secondary">{`${formatEnergy(estimate.kcal)}, ${formatMacros(estimate)}`}</AppText>
          <AppText variant="caption" tone="secondary">
            Ориентир по формуле Миффлина — Сан Жеора с учётом активности и цели. Это не медицинская рекомендация.
            Если у вас есть заболевания, беременность или расстройство пищевого поведения, обсудите цели с врачом.
          </AppText>
        </Panel>
      ) : (
        <AppText tone="secondary">
          Для расчёта нужны вес, рост и активность. Их можно указать в анкете: Профиль, «Изменить ответы и план».
        </AppText>
      )}

      <TextField keyboardType="decimal-pad" label="Калории в день" onChangeText={setKcalText} value={kcalText} />
      <TextField keyboardType="decimal-pad" label="Белки, г" onChangeText={setProteinText} value={proteinText} />
      <TextField keyboardType="decimal-pad" label="Жиры, г" onChangeText={setFatText} value={fatText} />
      <TextField keyboardType="decimal-pad" label="Углеводы, г" onChangeText={setCarbsText} value={carbsText} />
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button label="Сохранить свои цели" onPress={save} />
      {manual ? (
        <Button
          label="Вернуть расчёт"
          variant="secondary"
          onPress={() => run(() => clearManualTarget(database))}
        />
      ) : null}
    </>
  );
}

export default function NutritionTargetsScreen() {
  const { database, profile } = useAppData();
  const load = useCallback(() => getManualTarget(database), [database]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(manual) => <TargetsForm manual={manual} estimate={profile ? estimateTargets(profile) : null} />}
      </DataView>
    </Screen>
  );
}
