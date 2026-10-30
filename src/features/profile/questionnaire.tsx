import { useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { ChoiceGroup } from '@/components/choice-group';
import { AppText, Button, Panel, Screen, TextField, useTheme } from '@/design-system';
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
  allowedDaysPerWeek,
  allowedSessionMinutes,
  isValidAge,
  isValidName,
  isValidWeight,
} from '@/domains/profile/profile';
import { generatePlan } from '@/domains/program/generate-plan';
import {
  equipmentLabels,
  experienceLabels,
  goalLabels,
  limitationLabels,
  sexLabels,
} from '@/features/profile/labels';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, formatRepRange, parseDecimal, pluralize } from '@/lib/format';

const LAST_QUESTION_STEP = 6;
const REVIEW_STEP = 7;

type Draft = {
  name: string;
  ageText: string;
  sex: Sex | null;
  weightText: string;
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
  weightText: '',
  goal: null,
  experience: null,
  daysPerWeek: null,
  sessionMinutes: null,
  equipment: null,
  limitations: [],
};

function toDraft(profile: Profile | null): Draft {
  return profile
    ? { ...profile, ageText: String(profile.age), weightText: formatInputNumber(profile.weightKg) }
    : emptyDraft;
}

function choices<Value extends string>(labels: Record<Value, string>) {
  return (Object.keys(labels) as Value[]).map((value) => ({ value, label: labels[value] }));
}

function isStepComplete(step: number, draft: Draft) {
  switch (step) {
    case 0:
      return isValidName(draft.name) && isValidAge(parseDecimal(draft.ageText));
    case 1:
      return isValidWeight(parseDecimal(draft.weightText));
    case 2:
      return draft.goal !== null;
    case 3:
      return draft.experience !== null;
    case 4:
      return draft.daysPerWeek !== null && draft.sessionMinutes !== null;
    case 5:
      return draft.equipment !== null;
    default:
      return true;
  }
}

function toProfile(draft: Draft): Profile {
  return {
    name: draft.name.trim(),
    sex: draft.sex,
    age: parseDecimal(draft.ageText) as number,
    weightKg: parseDecimal(draft.weightText),
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
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const update = (changes: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...changes }));
  };

  const toggleLimitation = (limitation: Limitation) => {
    setDraft((current) => ({
      ...current,
      limitations: current.limitations.includes(limitation)
        ? current.limitations.filter((item) => item !== limitation)
        : [...current.limitations, limitation],
    }));
  };

  const goNext = () => {
    if (!isStepComplete(step, draft)) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep((current) => current + 1);
  };

  const age = parseDecimal(draft.ageText);
  const ageError = !isValidAge(age)
    ? `Укажите полный возраст от ${MIN_AGE} до ${MAX_AGE} лет: приложение рассчитано на взрослых`
    : null;
  const weightError = !isValidWeight(parseDecimal(draft.weightText))
    ? `Укажите вес от ${MIN_WEIGHT_KG} до ${MAX_WEIGHT_KG} кг или оставьте поле пустым`
    : null;

  if (step === REVIEW_STEP) {
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
      <Screen scroll belowHeader>
        <View style={{ gap: theme.spacing.s }}>
          <AppText accessibilityRole="header" variant="title">
            {initial ? 'Ваш новый план' : 'Ваш стартовый план'}
          </AppText>
          <AppText tone="secondary">
            {`${plan.length} ${pluralize(plan.length, ['тренировка', 'тренировки', 'тренировок'])} в цикле. Учтены цель, опыт, режим, условия и ограничения. План составлен правилами приложения, а не специалистом.`}
          </AppText>
          {initial ? (
            <AppText tone="secondary">Новый план заменит текущий. История тренировок сохранится.</AppText>
          ) : null}
        </View>

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
          onPress={() => setStep(LAST_QUESTION_STEP)}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll belowHeader>
      <AppText variant="callout" tone="secondary">
        {`Шаг ${step + 1} из ${LAST_QUESTION_STEP + 1}`}
      </AppText>

      {step === 0 ? (
        <View style={{ gap: theme.spacing.xl }}>
          <TextField
            autoCapitalize="words"
            autoComplete="given-name"
            error={showErrors && !isValidName(draft.name) ? 'Укажите имя' : null}
            label="Как вас зовут"
            onChangeText={(name) => update({ name })}
            value={draft.name}
          />
          <TextField
            error={showErrors ? ageError : null}
            keyboardType="number-pad"
            label="Возраст"
            onChangeText={(ageText) => update({ ageText })}
            value={draft.ageText}
          />
        </View>
      ) : null}

      {step === 1 ? (
        <View style={{ gap: theme.spacing.xl }}>
          <ChoiceGroup
            choices={[...choices(sexLabels), { value: null, label: 'Не указывать' }]}
            isSelected={(value) => draft.sex === value}
            label="Пол"
            onSelect={(sex) => update({ sex })}
          />
          <TextField
            error={showErrors ? weightError : null}
            keyboardType="decimal-pad"
            label="Вес, кг"
            onChangeText={(weightText) => update({ weightText })}
            value={draft.weightText}
          />
          <AppText variant="caption" tone="secondary">
            Оба ответа необязательны и пока не влияют на план.
          </AppText>
        </View>
      ) : null}

      {step === 2 ? (
        <ChoiceGroup
          choices={choices(goalLabels)}
          isSelected={(value) => draft.goal === value}
          label="Главная цель"
          onSelect={(goal) => update({ goal })}
        />
      ) : null}

      {step === 3 ? (
        <ChoiceGroup
          choices={choices(experienceLabels)}
          isSelected={(value) => draft.experience === value}
          label="Опыт силовых тренировок"
          onSelect={(experience) => update({ experience })}
        />
      ) : null}

      {step === 4 ? (
        <View style={{ gap: theme.spacing.xl }}>
          <ChoiceGroup
            choices={allowedDaysPerWeek.map((value) => ({ value, label: String(value) }))}
            isSelected={(value) => draft.daysPerWeek === value}
            label="Сколько дней в неделю"
            onSelect={(daysPerWeek) => update({ daysPerWeek })}
          />
          <ChoiceGroup
            choices={allowedSessionMinutes.map((value) => ({ value, label: `${value} мин` }))}
            isSelected={(value) => draft.sessionMinutes === value}
            label="Сколько длится тренировка"
            onSelect={(sessionMinutes) => update({ sessionMinutes })}
          />
        </View>
      ) : null}

      {step === 5 ? (
        <ChoiceGroup
          choices={choices(equipmentLabels)}
          isSelected={(value) => draft.equipment === value}
          label="Условия для тренировок"
          onSelect={(equipment) => update({ equipment })}
        />
      ) : null}

      {step === 6 ? (
        <View style={{ gap: theme.spacing.xl }}>
          <ChoiceGroup
            choices={choices(limitationLabels)}
            isSelected={(value) => draft.limitations.includes(value)}
            label="Что нельзя сильно нагружать"
            onSelect={toggleLimitation}
          />
          <AppText variant="caption" tone="secondary">
            Необязательно. Мы исключим упражнения, отмеченные в нашем каталоге для этих зон. Это не
            медицинская рекомендация.
          </AppText>
        </View>
      ) : null}

      {showErrors && !isStepComplete(step, draft) && step >= 2 ? (
        <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger">
          Выберите вариант, чтобы продолжить
        </AppText>
      ) : null}

      <Button label={step === LAST_QUESTION_STEP ? 'Показать план' : 'Далее'} onPress={goNext} />
      {step > 0 ? (
        <Button
          label="Назад"
          variant="secondary"
          onPress={() => {
            setShowErrors(false);
            setStep((current) => current - 1);
          }}
        />
      ) : null}
    </Screen>
  );
}
