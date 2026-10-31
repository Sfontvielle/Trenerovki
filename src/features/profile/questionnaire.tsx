import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { FadeIn } from '@/components/fade-in';
import { RulerPicker } from '@/components/ruler-picker';
import { WheelPicker } from '@/components/wheel-picker';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName } from '@/domains/exercises/catalog';
import { completeOnboarding } from '@/domains/profile/complete-onboarding';
import {
  type DaysPerWeek,
  type Equipment,
  type Experience,
  type Goal,
  type Limitation,
  MAX_AGE,
  MAX_WEIGHT_KG,
  MIN_AGE,
  MIN_WEIGHT_KG,
  type Profile,
  type SessionMinutes,
  type Sex,
  allowedSessionMinutes,
  isValidAge,
  isValidName,
  isValidWeight,
} from '@/domains/profile/profile';
import { generatePlan } from '@/domains/program/generate-plan';
import {
  equipmentHints,
  equipmentLabels,
  experienceHints,
  experienceLabels,
  goalHints,
  goalLabels,
  limitationLabels,
} from '@/features/profile/labels';
import { PlanAnalysis } from '@/features/profile/plan-analysis';
import {
  ChoiceCard,
  FrequencyPicker,
  QuestionHeader,
  QuestionTitle,
  SexCards,
  type SymbolName,
} from '@/features/profile/questionnaire-parts';
import { describeFailure } from '@/lib/describe-failure';
import { formatRepRange, parseDecimal, pluralize } from '@/lib/format';

const pages = [
  'name',
  'age',
  'sex',
  'weight',
  'goal',
  'experience',
  'days',
  'duration',
  'equipment',
  'limitations',
] as const;
type Page = (typeof pages)[number];

const REVIEW_PAGE = pages.length;
const WEIGHT_START_KG = 75;
const WEIGHT_STEP_KG = 0.5;
const AGE_START = 30;
const ages = Array.from({ length: MAX_AGE - MIN_AGE + 1 }, (_, index) => MIN_AGE + index);

const goalSymbols: Record<Goal, SymbolName> = {
  muscle: 'figure.strengthtraining.traditional',
  fat_loss: 'flame.fill',
  recomposition: 'arrow.triangle.2.circlepath',
  strength: 'dumbbell.fill',
  maintenance: 'heart.fill',
};

const equipmentSymbols: Record<Equipment, SymbolName> = {
  gym: 'dumbbell.fill',
  dumbbells: 'house.fill',
  bar: 'figure.strengthtraining.functional',
  bodyweight: 'figure.core.training',
};

type Draft = {
  name: string;
  ageText: string;
  sex: Sex | null;
  weightKg: number | null;
  goal: Goal | null;
  experience: Experience | null;
  daysPerWeek: DaysPerWeek | null;
  sessionMinutes: SessionMinutes | null;
  equipment: Equipment | null;
  limitations: Limitation[];
};

const emptyDraft: Draft = {
  name: '',
  ageText: '',
  sex: null,
  weightKg: null,
  goal: null,
  experience: null,
  daysPerWeek: null,
  sessionMinutes: null,
  equipment: null,
  limitations: [],
};

function toDraft(profile: Profile | null): Draft {
  return profile ? { ...profile, ageText: String(profile.age) } : emptyDraft;
}

function keysOf<Key extends string>(labels: Record<Key, string>) {
  return Object.keys(labels) as Key[];
}

function isPageComplete(page: Page, draft: Draft) {
  switch (page) {
    case 'name':
      return isValidName(draft.name);
    case 'age':
      return isValidAge(parseDecimal(draft.ageText));
    case 'weight':
      return isValidWeight(draft.weightKg);
    case 'goal':
      return draft.goal !== null;
    case 'experience':
      return draft.experience !== null;
    case 'days':
      return draft.daysPerWeek !== null;
    case 'duration':
      return draft.sessionMinutes !== null;
    case 'equipment':
      return draft.equipment !== null;
    default:
      return true;
  }
}

function continueLabel(page: Page, draft: Draft) {
  if (page === 'limitations') {
    return 'Показать план';
  }
  const skippable =
    (page === 'sex' && draft.sex === null) || (page === 'weight' && draft.weightKg === null);
  return skippable ? 'Пропустить' : 'Продолжить';
}

function toProfile(draft: Draft): Profile {
  return {
    name: draft.name.trim(),
    sex: draft.sex,
    age: parseDecimal(draft.ageText) as number,
    weightKg: draft.weightKg,
    goal: draft.goal as Goal,
    experience: draft.experience as Experience,
    daysPerWeek: draft.daysPerWeek as DaysPerWeek,
    sessionMinutes: draft.sessionMinutes as SessionMinutes,
    equipment: draft.equipment as Equipment,
    limitations: draft.limitations,
  };
}

type QuestionnaireProps = {
  initial: Profile | null;
  onDone?: () => void;
};

export function Questionnaire({ initial, onDone }: QuestionnaireProps) {
  const { database, refreshProfile } = useAppData();
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing, typography } = theme;
  const [pageIndex, setPageIndex] = useState(0);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [analyzing, setAnalyzing] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const finishAnalysis = useCallback(() => setAnalyzing(false), []);

  const update = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  const goBack = () => {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    } else if (router.canGoBack()) {
      router.back();
    }
  };

  if (pageIndex === REVIEW_PAGE) {
    if (analyzing) {
      return (
        <Screen fill ambient>
          <PlanAnalysis onDone={finishAnalysis} />
        </Screen>
      );
    }

    const profile = toProfile(draft);
    const plan = generatePlan(profile);

    const accept = async () => {
      setSaving(true);
      setSaveError(null);
      try {
        await completeOnboarding(database, profile, plan, createId, new Date());
      } catch (error) {
        console.error(error);
        setSaveError(`План не сохранён. ${describeFailure(error)}`);
        setSaving(false);
        return;
      }
      try {
        await refreshProfile();
        onDone?.();
      } catch (error) {
        console.error(error);
        setSaveError('План сохранён, но экран не обновился. Перезапустите приложение.');
        setSaving(false);
      }
    };

    return (
      <Screen scroll ambient>
        <FadeIn style={{ gap: spacing.xl }}>
          <QuestionTitle
            hint={`${plan.length} ${pluralize(plan.length, ['тренировка', 'тренировки', 'тренировок'])} в цикле. Учтены цель, опыт, режим, условия и ограничения. План составлен правилами приложения, а не специалистом.`}
            title={initial ? 'Ваш новый план' : 'Ваш стартовый план'}
          />
          {initial ? (
            <AppText tone="secondary" style={{ textAlign: 'center' }}>
              Новый план заменит текущий. История тренировок сохранится.
            </AppText>
          ) : null}

          {plan.map((day) => (
            <Panel key={day.name}>
              <AppText variant="heading">{day.name}</AppText>
              {day.exercises.map((exercise) => (
                <AppText key={exercise.exerciseId} variant="callout" tone="secondary">
                  {`${exerciseName(exercise.exerciseId)}: ${exercise.targetSets} × ${formatRepRange(exercise.repsMin, exercise.repsMax)}`}
                </AppText>
              ))}
            </Panel>
          ))}

          <AppText variant="callout" tone="secondary">
            Начинайте с лёгкого веса: подходы должны даваться с запасом.
          </AppText>
          {profile.limitations.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              Мы исключили упражнения, отмеченные в нашем каталоге для выбранных зон. Это не медицинская
              рекомендация.
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            IRONVANT не диагностирует и не лечит. Если есть боль, травма или заболевание, сначала
            посоветуйтесь с врачом и прекращайте упражнение при боли.
          </AppText>

          {saveError ? (
            <AppText accessibilityLiveRegion="polite" tone="danger">
              {saveError}
            </AppText>
          ) : null}
          <Button label="Принять план" loading={saving} onPress={accept} />
          <Button
            label="Изменить ответы"
            variant="secondary"
            disabled={saving}
            onPress={() => {
              setAnalyzing(true);
              setPageIndex(REVIEW_PAGE - 1);
            }}
          />
        </FadeIn>
      </Screen>
    );
  }

  const page = pages[pageIndex];
  const age = parseDecimal(draft.ageText);
  const ageError =
    draft.ageText !== '' && !isValidAge(age)
      ? `Укажите полный возраст от ${MIN_AGE} до ${MAX_AGE} лет: приложение рассчитано на взрослых`
      : null;
  const weightError = !isValidWeight(draft.weightKg)
    ? `Укажите вес от ${MIN_WEIGHT_KG} до ${MAX_WEIGHT_KG} кг`
    : null;
  const inputSurface = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: sizes.border,
    color: colors.textPrimary,
  };

  return (
    <Screen scroll fill ambient>
      <QuestionHeader current={pageIndex + 1} total={pages.length} onBack={goBack} />

      <FadeIn key={page} style={{ flex: 1, gap: spacing.xl }}>
        {page === 'name' ? (
          <>
            <QuestionTitle title="Как вас зовут?" hint="Так мы будем к вам обращаться" />
            <TextInput
              accessibilityLabel="Как вас зовут"
              autoCapitalize="words"
              autoComplete="given-name"
              autoFocus={!draft.name}
              keyboardAppearance={theme.mode}
              maxFontSizeMultiplier={theme.maxFontScale}
              maxLength={40}
              onChangeText={(name) => update({ name })}
              placeholder="Ваше имя"
              placeholderTextColor={colors.textSecondary}
              selectionColor={colors.accent}
              style={[
                typography.heading,
                inputSurface,
                { borderRadius: radii.panel, minHeight: sizes.choiceMinHeight, paddingHorizontal: spacing.l },
              ]}
              value={draft.name}
            />
          </>
        ) : null}

        {page === 'age' ? (
          <>
            <QuestionTitle title="Сколько вам лет?" hint={`Приложение рассчитано на взрослых от ${MIN_AGE} лет`} />
            <WheelPicker
              label="Возраст, лет"
              onChange={(value) => update({ ageText: String(value) })}
              start={AGE_START}
              value={isValidAge(age) ? age : null}
              values={ages}
            />
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.s, justifyContent: 'center' }}>
              <AppText variant="callout" tone="secondary">
                или введите:
              </AppText>
              <TextInput
                accessibilityLabel="Возраст"
                keyboardAppearance={theme.mode}
                keyboardType="number-pad"
                maxFontSizeMultiplier={theme.maxFontScale}
                maxLength={3}
                onChangeText={(ageText) => update({ ageText })}
                placeholder="—"
                placeholderTextColor={colors.textSecondary}
                selectionColor={colors.accent}
                style={[
                  typography.heading,
                  inputSurface,
                  {
                    borderRadius: radii.chip,
                    minHeight: sizes.minTouch,
                    textAlign: 'center',
                    width: sizes.control * 1.4,
                  },
                ]}
                value={draft.ageText}
              />
            </View>
            {ageError ? (
              <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger" style={{ textAlign: 'center' }}>
                {ageError}
              </AppText>
            ) : null}
          </>
        ) : null}

        {page === 'sex' ? (
          <>
            <QuestionTitle title="Ваш пол" hint="Необязательно. Пока не влияет на план" />
            <SexCards value={draft.sex} onChange={(sex) => update({ sex })} />
          </>
        ) : null}

        {page === 'weight' ? (
          <>
            <QuestionTitle title="Сколько вы весите?" hint="Необязательно. Пока не влияет на план" />
            <RulerPicker
              label="Вес"
              max={MAX_WEIGHT_KG}
              min={MIN_WEIGHT_KG}
              onChange={(weightKg) => update({ weightKg })}
              start={WEIGHT_START_KG}
              step={WEIGHT_STEP_KG}
              unit="кг"
              value={draft.weightKg}
            />
            {weightError ? (
              <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger" style={{ textAlign: 'center' }}>
                {weightError}
              </AppText>
            ) : null}
          </>
        ) : null}

        {page === 'goal' ? (
          <>
            <QuestionTitle title="Ваша главная цель" />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {keysOf(goalLabels).map((goal) => (
                <ChoiceCard
                  key={goal}
                  hint={goalHints[goal]}
                  onPress={() => update({ goal })}
                  selected={draft.goal === goal}
                  symbol={goalSymbols[goal]}
                  title={goalLabels[goal]}
                />
              ))}
            </View>
          </>
        ) : null}

        {page === 'experience' ? (
          <>
            <QuestionTitle title="Ваш опыт силовых тренировок" />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {keysOf(experienceLabels).map((experience) => (
                <ChoiceCard
                  key={experience}
                  hint={experienceHints[experience]}
                  onPress={() => update({ experience })}
                  selected={draft.experience === experience}
                  title={experienceLabels[experience]}
                />
              ))}
            </View>
          </>
        ) : null}

        {page === 'days' ? (
          <>
            <QuestionTitle title="Сколько раз в неделю вы планируете тренироваться?" />
            <FrequencyPicker value={draft.daysPerWeek} onChange={(daysPerWeek) => update({ daysPerWeek })} />
          </>
        ) : null}

        {page === 'duration' ? (
          <>
            <QuestionTitle title="Сколько длится одна тренировка?" />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {allowedSessionMinutes.map((minutes) => (
                <ChoiceCard
                  key={minutes}
                  onPress={() => update({ sessionMinutes: minutes })}
                  selected={draft.sessionMinutes === minutes}
                  title={`${minutes} минут`}
                />
              ))}
            </View>
          </>
        ) : null}

        {page === 'equipment' ? (
          <>
            <QuestionTitle title="В каких условиях вы тренируетесь?" />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {keysOf(equipmentLabels).map((equipment) => (
                <ChoiceCard
                  key={equipment}
                  hint={equipmentHints[equipment]}
                  onPress={() => update({ equipment })}
                  selected={draft.equipment === equipment}
                  symbol={equipmentSymbols[equipment]}
                  title={equipmentLabels[equipment]}
                />
              ))}
            </View>
          </>
        ) : null}

        {page === 'limitations' ? (
          <>
            <QuestionTitle
              hint="Необязательно. Мы исключим упражнения, отмеченные в нашем каталоге для этих зон. Это не медицинская рекомендация."
              title="Что нельзя сильно нагружать?"
            />
            <View style={{ gap: spacing.m }}>
              {keysOf(limitationLabels).map((limitation) => (
                <ChoiceCard
                  key={limitation}
                  multiple
                  onPress={() =>
                    update({
                      limitations: draft.limitations.includes(limitation)
                        ? draft.limitations.filter((item) => item !== limitation)
                        : [...draft.limitations, limitation],
                    })
                  }
                  selected={draft.limitations.includes(limitation)}
                  title={limitationLabels[limitation]}
                />
              ))}
            </View>
          </>
        ) : null}
      </FadeIn>

      <Button
        disabled={!isPageComplete(page, draft)}
        label={continueLabel(page, draft)}
        onPress={() => {
          setAnalyzing(true);
          setPageIndex(pageIndex + 1);
        }}
      />
    </Screen>
  );
}
