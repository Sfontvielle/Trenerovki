import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen, TextField } from '@/design-system';
import type { Nutrients } from '@/domains/nutrition/nutrition';
import { clearManualTarget, getManualTarget, saveManualTarget } from '@/domains/nutrition/nutrition-repository';
import { MIN_KCAL_OTHER, estimateTargets } from '@/domains/nutrition/targets';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, parseDecimal } from '@/lib/format';
import { t } from '@/lib/i18n';

const MAX_DAILY_KCAL = 10000;
const MAX_DAILY_GRAMS = 1000;

type TargetsFormProps = {
  manual: Nutrients | null;
  estimate: ReturnType<typeof estimateTargets>;
};

function TargetsForm({ manual, estimate }: TargetsFormProps) {
  const { database } = useAppData();
  const start = manual ?? estimate;
  const [kcalText, setKcalText] = useState(formatInputNumber(start?.kcal));
  const [proteinText, setProteinText] = useState(formatInputNumber(start?.protein));
  const [fatText, setFatText] = useState(formatInputNumber(start?.fat));
  const [carbsText, setCarbsText] = useState(formatInputNumber(start?.carbs));
  const [error, setError] = useState<string | null>(null);
  const typedKcal = parseDecimal(kcalText);

  const run = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(t('Цели не сохранены. {0}', { 0: describeFailure(cause) }));
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
      setError(t('Заполните все поля числами: калории до 10000, остальное до 1000 г.'));
      return;
    }
    run(() => saveManualTarget(database, target as Nutrients, new Date()));
  };

  return (
    <>
      {estimate ? (
        <Panel>
          <AppText variant="heading">{t('Расчёт по вашим ответам')}</AppText>
          <AppText tone="secondary">{`${formatEnergy(estimate.kcal)}, ${formatMacros(estimate)}`}</AppText>
          {estimate.lowWeight ? (
            <AppText variant="callout" tone="warning">
              {t('Для вашего роста и веса приложение не рассчитывает дефицит калорий. Поговорите с врачом или диетологом, прежде чем снижать вес.')}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            {t('Ориентир по формуле Миффлина — Сан Жеора с учётом активности и цели. Если пол не указан, берётся среднее значение. Есть нижняя граница: 1200 ккал, для мужчин 1500 ккал. При высоком весе белки и жиры считаются от меньшего расчётного веса. Расчёт идёт по весу из анкеты и сам не меняется. Это не медицинская рекомендация. Если у вас есть заболевания, беременность, кормление грудью или расстройство пищевого поведения, обсудите цели с врачом.')}
          </AppText>
        </Panel>
      ) : (
        <AppText tone="secondary">
          {t('Для расчёта нужны вес, рост и активность. Их можно указать в анкете: Профиль, «Изменить ответы и план».')}
        </AppText>
      )}

      <TextField keyboardType="decimal-pad" label={t('Калории в день')} onChangeText={setKcalText} value={kcalText} />
      <TextField keyboardType="decimal-pad" label={t('Белки, г')} onChangeText={setProteinText} value={proteinText} />
      <TextField keyboardType="decimal-pad" label={t('Жиры, г')} onChangeText={setFatText} value={fatText} />
      <TextField keyboardType="decimal-pad" label={t('Углеводы, г')} onChangeText={setCarbsText} value={carbsText} />
      {typedKcal !== null && typedKcal < MIN_KCAL_OTHER ? (
        <AppText accessibilityLiveRegion="polite" tone="warning">
          {t('Это ниже нижней границы расчёта. Очень низкая калорийность может быть опасна: обсудите её с врачом.')}
        </AppText>
      ) : null}
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button label={t('Сохранить свои цели')} onPress={save} />
      {manual ? (
        <Button
          label={t('Вернуть расчёт')}
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
