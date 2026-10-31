import { ChoiceGroup } from '@/components/choice-group';
import { TextField } from '@/design-system';
import type { Tracking } from '@/domains/exercises/catalog';
import { type SetInput, type SetKind, type WorkoutSet, setKinds } from '@/domains/workout/types';
import { validateSet } from '@/domains/workout/workout-engine';
import { setKindLabels } from '@/features/workout/set-labels';
import { formatInputNumber, parseDecimal } from '@/lib/format';

const SECONDS_IN_MINUTE = 60;
const METERS_IN_KM = 1000;

export type SetFormValues = {
  weightText: string;
  repsText: string;
  rirText: string;
  durationText: string;
  distanceText: string;
  kind: SetKind;
  noteText: string;
};

type Prefill = {
  reps?: number | null;
  durationSec?: number | null;
};

function toDurationText(seconds: number | null | undefined, tracking: Tracking) {
  if (seconds === null || seconds === undefined) {
    return '';
  }
  return formatInputNumber(tracking === 'cardio' ? seconds / SECONDS_IN_MINUTE : seconds);
}

export function toSetForm(set: WorkoutSet | undefined, prefill: Prefill, tracking: Tracking): SetFormValues {
  return {
    weightText: formatInputNumber(set?.weightKg),
    repsText: formatInputNumber(set?.reps ?? prefill.reps),
    rirText: formatInputNumber(set?.rir),
    durationText: toDurationText(set?.durationSec ?? prefill.durationSec, tracking),
    distanceText: formatInputNumber(set?.distanceM ? set.distanceM / METERS_IN_KM : null),
    kind: 'working',
    noteText: '',
  };
}

export function parseSetForm(form: SetFormValues, tracking: Tracking): SetInput | null {
  const timed = tracking !== 'reps';
  const duration = parseDecimal(form.durationText);
  const distance = parseDecimal(form.distanceText);
  const input: SetInput = {
    weightKg: parseDecimal(form.weightText),
    reps: timed ? null : (parseDecimal(form.repsText) ?? Number.NaN),
    rir: timed ? null : parseDecimal(form.rirText),
    kind: form.kind,
    note: form.noteText.trim() || null,
    durationSec:
      timed && duration !== null
        ? Math.round(tracking === 'cardio' ? duration * SECONDS_IN_MINUTE : duration)
        : null,
    distanceM: timed && distance !== null ? distance * METERS_IN_KM : null,
  };
  try {
    validateSet(input);
    return input;
  } catch {
    return null;
  }
}

export function setFormProblem(tracking: Tracking) {
  return tracking === 'reps'
    ? 'Проверьте значения: вес до 1000 кг, повторы целым числом от 1, запас от 0 до 10.'
    : 'Укажите время больше нуля. Вес и дистанция необязательны.';
}

type SetFieldsProps = {
  form: SetFormValues;
  tracking: Tracking;
  onChange: (changes: Partial<SetFormValues>) => void;
};

export function SetFields({ form, tracking, onChange }: SetFieldsProps) {
  return (
    <>
      {tracking === 'cardio' ? null : (
        <TextField
          hint="Оставьте пустым для упражнений со своим весом"
          keyboardType="decimal-pad"
          label="Вес, кг"
          onChangeText={(weightText) => onChange({ weightText })}
          value={form.weightText}
        />
      )}
      {tracking === 'reps' ? (
        <>
          <TextField
            keyboardType="number-pad"
            label="Повторы"
            onChangeText={(repsText) => onChange({ repsText })}
            value={form.repsText}
          />
          <TextField
            hint="Сколько повторов вы могли бы ещё сделать. Необязательно"
            keyboardType="number-pad"
            label="Запас повторов"
            onChangeText={(rirText) => onChange({ rirText })}
            value={form.rirText}
          />
        </>
      ) : (
        <TextField
          keyboardType="decimal-pad"
          label={tracking === 'cardio' ? 'Время, мин' : 'Время, сек'}
          onChangeText={(durationText) => onChange({ durationText })}
          value={form.durationText}
        />
      )}
      {tracking === 'cardio' ? (
        <TextField
          hint="Необязательно"
          keyboardType="decimal-pad"
          label="Дистанция, км"
          onChangeText={(distanceText) => onChange({ distanceText })}
          value={form.distanceText}
        />
      ) : null}
      <ChoiceGroup
        choices={setKinds.map((value) => ({ value, label: setKindLabels[value] }))}
        isSelected={(value) => form.kind === value}
        label="Тип подхода"
        onSelect={(kind) => onChange({ kind })}
      />
      <TextField
        label="Заметка"
        maxLength={200}
        onChangeText={(noteText) => onChange({ noteText })}
        value={form.noteText}
      />
    </>
  );
}
