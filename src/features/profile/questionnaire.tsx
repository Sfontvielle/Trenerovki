import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { TextInput, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { ChoiceGroup } from '@/components/choice-group';
import { FadeIn } from '@/components/fade-in';
import { RulerPicker } from '@/components/ruler-picker';
import { WheelPicker } from '@/components/wheel-picker';
import { AppText, Button, Panel, Screen, useTheme } from '@/design-system';
import { listAvoidedExercises } from '@/domains/coach/coach-repository';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName } from '@/domains/exercises/catalog';
import { completeOnboarding, saveAnswers } from '@/domains/profile/complete-onboarding';
import {
  type ActivityLevel,
  type Baseline,
  type DaysPerWeek,
  type Diet,
  type Equipment,
  type Experience,
  type Goal,
  type Limitation,
  MAX_AGE,
  MAX_HEIGHT_CM,
  MAX_WEIGHT_KG,
  MIN_AGE,
  MIN_HEIGHT_CM,
  MIN_WEIGHT_KG,
  type NutritionMode,
  type Profile,
  type SessionMinutes,
  type Sex,
  allowedSessionMinutes,
  isValidAge,
  isValidHeight,
  isValidName,
  isValidWeight,
} from '@/domains/profile/profile';
import { estimateTargets } from '@/domains/nutrition/targets';
import { generatePlan } from '@/domains/program/generate-plan';
import { formatEnergy, formatMacros } from '@/features/nutrition/format-nutrition';
import {
  activityHints,
  activityLabels,
  baselineLabels,
  dietLabels,
  equipmentHints,
  equipmentLabels,
  experienceHints,
  experienceLabels,
  goalHints,
  goalLabels,
  limitationLabels,
  nutritionModeLabels,
  sleepChoices,
} from '@/features/profile/labels';
import { PlanAnalysis } from '@/features/profile/plan-analysis';
import {
  ChoiceCard,
  FrequencyPicker,
  QuestionHeader,
  QuestionTitle,
  SexCards,
  type SymbolName,
  WeekdayPicker,
} from '@/features/profile/questionnaire-parts';
import { describeTarget } from '@/features/workout/set-labels';
import { describeFailure } from '@/lib/describe-failure';
import { parseDecimal, pluralize } from '@/lib/format';
import { t } from '@/lib/i18n';

const pages = [
  'name',
  'age',
  'sex',
  'weight',
  'height',
  'goal',
  'experience',
  'baseline',
  'days',
  'weekdays',
  'duration',
  'equipment',
  'limitations',
  'lifestyle',
  'nutrition',
] as const;
type Page = (typeof pages)[number];

const REVIEW_PAGE = pages.length;
const WEIGHT_START_KG = 75;
const WEIGHT_STEP_KG = 0.5;
const HEIGHT_START_CM = 170;
const HEIGHT_STEP_CM = 1;
const SHORT_SLEEP_HOURS = 6;
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
  trainingDays: number[];
  heightCm: number | null;
  activityLevel: ActivityLevel | null;
  usualSleepHours: number | null;
  baseline: Baseline | null;
  nutritionMode: NutritionMode;
  diet: Diet;
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
  trainingDays: [],
  heightCm: null,
  activityLevel: null,
  usualSleepHours: null,
  baseline: null,
  nutritionMode: 'targets',
  diet: 'any',
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
    case 'height':
      return isValidHeight(draft.heightCm);
    case 'goal':
      return draft.goal !== null;
    case 'experience':
      return draft.experience !== null;
    case 'days':
      return draft.daysPerWeek !== null;
    case 'weekdays':
      return draft.trainingDays.length === 0 || draft.trainingDays.length === draft.daysPerWeek;
    case 'duration':
      return draft.sessionMinutes !== null;
    case 'equipment':
      return draft.equipment !== null;
    default:
      return true;
  }
}

function continueLabel(page: Page, draft: Draft) {
  if (page === 'nutrition') {
    return t('Показать план');
  }
  const skippable =
    (page === 'sex' && draft.sex === null) ||
    (page === 'weight' && draft.weightKg === null) ||
    (page === 'height' && draft.heightCm === null) ||
    (page === 'baseline' && draft.baseline === null) ||
    (page === 'lifestyle' && draft.activityLevel === null && draft.usualSleepHours === null) ||
    (page === 'weekdays' && draft.trainingDays.length === 0);
  return skippable ? t('Пропустить') : t('Продолжить');
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
    trainingDays: draft.trainingDays,
    heightCm: draft.heightCm,
    activityLevel: draft.activityLevel,
    usualSleepHours: draft.usualSleepHours,
    baseline: draft.baseline,
    nutritionMode: draft.nutritionMode,
    diet: draft.diet,
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
  const [avoided, setAvoided] = useState<string[]>([]);
  const finishAnalysis = useCallback(() => setAnalyzing(false), []);

  useEffect(() => {
    let active = true;
    listAvoidedExercises(database)
      .then((ids) => {
        if (active) {
          setAvoided(ids);
        }
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [database]);

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
    const plan = generatePlan({ ...profile, excluded: avoided });
    const targets = profile.nutritionMode === 'diary' ? null : estimateTargets(profile);

    const accept = async (replacePlan: boolean) => {
      setSaving(true);
      setSaveError(null);
      try {
        if (replacePlan) {
          await completeOnboarding(database, profile, plan, createId, new Date());
        } else {
          await saveAnswers(database, profile, new Date());
        }
      } catch (error) {
        console.error(error);
        setSaveError(t('План не сохранён. {0}', { 0: describeFailure(error) }));
        setSaving(false);
        return;
      }
      try {
        await refreshProfile();
        onDone?.();
      } catch (error) {
        console.error(error);
        setSaveError(t('План сохранён, но экран не обновился. Перезапустите приложение.'));
        setSaving(false);
      }
    };

    return (
      <Screen scroll ambient>
        <FadeIn style={{ gap: spacing.xl }}>
          <QuestionTitle
            hint={t('{0} {1} в цикле. Цель задаёт повторы и кардио. Упражнения подобраны автоматически по опыту, числу тренировок, времени и условиям{2}. Специалист план не проверял.', { 0: plan.length, 1: pluralize(plan.length, [t('тренировка'), t('тренировки'), t('тренировок')]), 2: profile.limitations.length > 0 ? t(', а также по выбранным ограничениям') : '' })}
            title={initial ? t('Ваш новый план') : t('Ваш стартовый план')}
          />
          {initial ? (
            <AppText tone="secondary" style={{ textAlign: 'center' }}>
              {t('Новый план заменит текущий вместе с вашими заменами и добавленными упражнениями. Прежний план останется в истории решений Coach. История тренировок сохранится.')}
            </AppText>
          ) : null}

          {plan.map((day) => (
            <Panel key={day.name}>
              <AppText variant="heading">{day.name}</AppText>
              {day.exercises.map((exercise) => (
                <AppText key={exercise.exerciseId} variant="callout" tone="secondary">
                  {`${exerciseName(exercise.exerciseId)}: ${describeTarget({ sets: exercise.targetSets, repsMin: exercise.repsMin, repsMax: exercise.repsMax, durationSec: exercise.targetDurationSec ?? null })}`}
                </AppText>
              ))}
            </Panel>
          ))}

          <AppText variant="callout" tone="secondary">
            {t('Начинайте с лёгкого веса: подходы должны даваться с запасом. Перед первым тяжёлым упражнением сделайте 1–2 лёгких разминочных подхода и отметьте их как «Разминка».')}
          </AppText>
          {targets ? (
            <AppText variant="callout" tone="secondary">
              {t('Ориентир по питанию на день: {0}, {1}. Его можно изменить на вкладке «Питание». Это не медицинская рекомендация. При заболеваниях, беременности, кормлении грудью или расстройстве пищевого поведения обсудите цели с врачом.', { 0: formatEnergy(targets.kcal), 1: formatMacros(targets) })}
            </AppText>
          ) : null}
          {targets?.lowWeight ? (
            <AppText variant="callout" tone="warning">
              {t('Для вашего роста и веса приложение не рассчитывает дефицит калорий. Поговорите с врачом или диетологом, прежде чем снижать вес.')}
            </AppText>
          ) : null}
          {profile.usualSleepHours !== null && profile.usualSleepHours < SHORT_SLEEP_HOURS ? (
            <AppText variant="callout" tone="secondary">
              {t('Вы спите меньше 6 часов. При недосыпе восстановление идёт хуже: следите за самочувствием.')}
            </AppText>
          ) : null}
          {profile.limitations.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              {t('Мы убрали упражнения, которые по нашей разметке заметно нагружают выбранные зоны. Разметка не проверена специалистом, и другие упражнения тоже могут нагружать эти зоны. При боли остановитесь. Это не медицинская рекомендация.')}
            </AppText>
          ) : null}
          <AppText variant="caption" tone="secondary">
            {t('IRONVANT не диагностирует и не лечит. Если у вас есть боль, травма, заболевание или беременность, посоветуйтесь с врачом до начала тренировок. При боли прекратите упражнение. При боли в груди, сильной одышке, головокружении или слабости остановите тренировку и обратитесь за неотложной помощью.')}
          </AppText>

          {saveError ? (
            <AppText accessibilityLiveRegion="polite" tone="danger">
              {saveError}
            </AppText>
          ) : null}
          <Button
            label={initial ? t('Заменить план') : t('Принять план')}
            loading={saving}
            onPress={() => accept(true)}
          />
          {initial ? (
            <Button
              disabled={saving}
              label={t('Сохранить ответы, план не менять')}
              variant="secondary"
              onPress={() => accept(false)}
            />
          ) : null}
          <Button
            label={t('Изменить ответы')}
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
      ? t('Укажите полный возраст от {0} до {1} лет: приложение рассчитано на взрослых', { 0: MIN_AGE, 1: MAX_AGE })
      : null;
  const weightError = !isValidWeight(draft.weightKg)
    ? t('Укажите вес от {0} до {1} кг', { 0: MIN_WEIGHT_KG, 1: MAX_WEIGHT_KG })
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
            <QuestionTitle title={t('Как вас зовут?')} hint={t('Имя видно только в вашем профиле')} />
            <TextInput
              accessibilityLabel={t('Как вас зовут')}
              autoCapitalize="words"
              autoComplete="given-name"
              autoFocus={!draft.name}
              keyboardAppearance={theme.mode}
              maxFontSizeMultiplier={theme.maxFontScale}
              maxLength={40}
              onChangeText={(name) => update({ name })}
              placeholder={t('Ваше имя')}
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
            <QuestionTitle title={t('Сколько вам лет?')} hint={t('Прокрутите колесо или коснитесь своего возраста. Приложение рассчитано на взрослых от {0} лет', { 0: MIN_AGE })} />
            <WheelPicker
              label={t('Возраст, лет')}
              onChange={(value) => update({ ageText: String(value) })}
              start={AGE_START}
              value={isValidAge(age) ? age : null}
              values={ages}
            />
            <View style={{ alignItems: 'center', flexDirection: 'row', gap: spacing.s, justifyContent: 'center' }}>
              <AppText variant="callout" tone="secondary">
                {t('или введите:')}
              </AppText>
              <TextInput
                accessibilityLabel={t('Возраст')}
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
            <QuestionTitle title={t('Ваш пол')} hint={t('Необязательно. Нужен только для оценки калорий')} />
            <SexCards value={draft.sex} onChange={(sex) => update({ sex })} />
          </>
        ) : null}

        {page === 'weight' ? (
          <>
            <QuestionTitle title={t('Сколько вы весите?')} hint={t('Необязательно. Нужен для оценки калорий и белка')} />
            <RulerPicker
              label={t('Вес')}
              max={MAX_WEIGHT_KG}
              min={MIN_WEIGHT_KG}
              onChange={(weightKg) => update({ weightKg })}
              start={WEIGHT_START_KG}
              step={WEIGHT_STEP_KG}
              unit={t('кг')}
              value={draft.weightKg}
            />
            {weightError ? (
              <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger" style={{ textAlign: 'center' }}>
                {weightError}
              </AppText>
            ) : null}
            {draft.weightKg !== null ? (
              <Button
                label={t('Не указывать вес')}
                variant="secondary"
                onPress={() => update({ weightKg: null })}
              />
            ) : null}
          </>
        ) : null}

        {page === 'height' ? (
          <>
            <QuestionTitle title={t('Какой у вас рост?')} hint={t('Необязательно. Нужен только для оценки калорий')} />
            <RulerPicker
              label={t('Рост')}
              max={MAX_HEIGHT_CM}
              min={MIN_HEIGHT_CM}
              onChange={(heightCm) => update({ heightCm })}
              start={HEIGHT_START_CM}
              step={HEIGHT_STEP_CM}
              unit={t('см')}
              value={draft.heightCm}
            />
            {!isValidHeight(draft.heightCm) ? (
              <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger" style={{ textAlign: 'center' }}>
                {t('Укажите рост от {0} до {1} см', { 0: MIN_HEIGHT_CM, 1: MAX_HEIGHT_CM })}
              </AppText>
            ) : null}
            {draft.heightCm !== null ? (
              <Button label={t('Не указывать рост')} variant="secondary" onPress={() => update({ heightCm: null })} />
            ) : null}
          </>
        ) : null}

        {page === 'baseline' ? (
          <>
            <QuestionTitle
              hint={t('Необязательно. Делать ничего не нужно, ответьте по памяти. Отжимания с колен тоже считаются. Ответ помогает не ставить слишком сложные упражнения')}
              title={t('Сколько отжиманий подряд вы сделаете?')}
            />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {keysOf(baselineLabels).map((baseline) => (
                <ChoiceCard
                  key={baseline}
                  onPress={() => update({ baseline })}
                  selected={draft.baseline === baseline}
                  title={baselineLabels[baseline]}
                />
              ))}
            </View>
          </>
        ) : null}

        {page === 'goal' ? (
          <>
            <QuestionTitle title={t('Ваша главная цель')} />
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
            <QuestionTitle title={t('Ваш опыт силовых тренировок')} />
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
            <QuestionTitle title={t('Сколько раз в неделю вы планируете тренироваться?')} />
            <FrequencyPicker value={draft.daysPerWeek} onChange={(daysPerWeek) => update({ daysPerWeek })} />
          </>
        ) : null}

        {page === 'weekdays' ? (
          <>
            <QuestionTitle
              hint={t('Необязательно. Выберите {0} {1}, и приложение подскажет, когда тренировка по плану', { 0: draft.daysPerWeek, 1: pluralize(draft.daysPerWeek ?? 0, [t('день'), t('дня'), t('дней')]) })}
              title={t('В какие дни удобно тренироваться?')}
            />
            <WeekdayPicker
              onToggle={(day) =>
                update({
                  trainingDays: draft.trainingDays.includes(day)
                    ? draft.trainingDays.filter((item) => item !== day)
                    : [...draft.trainingDays, day],
                })
              }
              value={draft.trainingDays}
            />
          </>
        ) : null}

        {page === 'duration' ? (
          <>
            <QuestionTitle title={t('Сколько времени вы готовы тратить на тренировку?')} />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {allowedSessionMinutes.map((minutes) => (
                <ChoiceCard
                  key={minutes}
                  onPress={() => update({ sessionMinutes: minutes })}
                  selected={draft.sessionMinutes === minutes}
                  title={t('{0} минут', { 0: minutes })}
                />
              ))}
            </View>
          </>
        ) : null}

        {page === 'equipment' ? (
          <>
            <QuestionTitle title={t('В каких условиях вы тренируетесь?')} />
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
              hint={t('Необязательно. Уберём из плана упражнения, которые по нашей разметке заметно нагружают эти зоны. Другие ограничения план не учитывает: посоветуйтесь с врачом. Это не медицинская рекомендация.')}
              title={t('Что нельзя сильно нагружать?')}
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

        {page === 'lifestyle' ? (
          <>
            <QuestionTitle hint={t('Необязательно. Активность нужна для оценки калорий, сон учитывается только в совете к плану')} title={t('Ваш обычный день')} />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {keysOf(activityLabels).map((activityLevel) => (
                <ChoiceCard
                  key={activityLevel}
                  hint={activityHints[activityLevel]}
                  onPress={() => update({ activityLevel })}
                  selected={draft.activityLevel === activityLevel}
                  title={activityLabels[activityLevel]}
                />
              ))}
            </View>
            <ChoiceGroup
              choices={sleepChoices.map(({ hours, label }) => ({ value: hours, label }))}
              isSelected={(hours) => draft.usualSleepHours === hours}
              label={t('Сколько вы обычно спите')}
              onSelect={(usualSleepHours) => update({ usualSleepHours })}
            />
          </>
        ) : null}

        {page === 'nutrition' ? (
          <>
            <QuestionTitle hint={t('Можно изменить в любой момент')} title={t('Как вести питание?')} />
            <View accessibilityRole="radiogroup" style={{ gap: spacing.m }}>
              {keysOf(nutritionModeLabels).map((nutritionMode) => (
                <ChoiceCard
                  key={nutritionMode}
                  onPress={() => update({ nutritionMode })}
                  selected={draft.nutritionMode === nutritionMode}
                  title={nutritionModeLabels[nutritionMode]}
                />
              ))}
            </View>
            <ChoiceGroup
              choices={keysOf(dietLabels).map((value) => ({ value, label: dietLabels[value] }))}
              isSelected={(diet) => draft.diet === diet}
              label={t('Питание в базе продуктов')}
              onSelect={(diet) => update({ diet })}
            />
            <AppText variant="caption" tone="secondary">
              {t('Это только фильтр поиска. Состав проверяйте на упаковке.')}
            </AppText>
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
