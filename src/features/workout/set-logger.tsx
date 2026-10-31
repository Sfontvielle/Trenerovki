import { useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { ChoiceGroup } from '@/components/choice-group';
import { AppText, Button, Panel, TextField, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { suggestNextWeight } from '@/domains/workout/progression';
import { type SessionExercise, type SetInput, type SetKind, type WorkoutSet, setKinds } from '@/domains/workout/types';
import { validateSet } from '@/domains/workout/workout-engine';
import { describeSet, setKindLabels } from '@/features/workout/set-labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, formatWeight, parseDecimal } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';

type SetLoggerProps = {
  exercise: SessionExercise;
  lastSets: WorkoutSet[];
  paused: boolean;
  suggestionsAllowed: boolean;
  onChanged: () => void;
};

type FormValues = {
  weightText: string;
  repsText: string;
  rirText: string;
  kind: SetKind;
  noteText: string;
};

function toForm(set: WorkoutSet | undefined, plannedReps: number | null): FormValues {
  return {
    weightText: formatInputNumber(set?.weightKg),
    repsText: formatInputNumber(set?.reps ?? plannedReps),
    rirText: formatInputNumber(set?.rir),
    kind: 'working',
    noteText: '',
  };
}

function parseSet({ weightText, repsText, rirText, kind, noteText }: FormValues): SetInput | null {
  const input = {
    weightKg: parseDecimal(weightText),
    reps: parseDecimal(repsText) ?? Number.NaN,
    rir: parseDecimal(rirText),
    kind,
    note: noteText.trim() || null,
  };
  try {
    validateSet(input);
    return input;
  } catch {
    return null;
  }
}

export function SetLogger({ exercise, lastSets, paused, suggestionsAllowed, onChanged }: SetLoggerProps) {
  const { engine } = useAppData();
  const { theme } = useTheme();
  const previous = exercise.sets.at(-1) ?? lastSets[exercise.sets.length] ?? lastSets.at(-1);
  const suggestion =
    suggestionsAllowed && exercise.sets.length === 0
      ? suggestNextWeight(lastSets, exercise.repsMax, exercise.plannedSets)
      : null;

  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [form, setForm] = useState(() => toForm(previous, exercise.repsMin));
  const [operationId, setOperationId] = useState(createId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (changes: Partial<FormValues>) => setForm((current) => ({ ...current, ...changes }));

  const startEditing = (set: WorkoutSet) => {
    setEditing(set);
    setForm({ ...toForm(set, null), kind: set.kind, noteText: set.note ?? '' });
    setError(null);
  };

  const stopEditing = () => {
    setEditing(null);
    setForm(toForm(previous, exercise.repsMin));
    setError(null);
  };

  const submit = async () => {
    const input = parseSet(form);
    if (!input) {
      setError('Проверьте значения: вес до 1000 кг, повторы целым числом от 1, запас от 0 до 10.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await engine.updateSet(editing.id, input, operationId);
      } else {
        await engine.logSet(exercise.id, input, operationId);
      }
      setOperationId(createId());
      successFeedback();
      onChanged();
    } catch (cause) {
      console.error(cause);
      setError(`Подход не сохранён. ${describeFailure(cause)}`);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (set: WorkoutSet) => {
    const approved = await confirm({
      title: 'Удалить подход?',
      message: describeSet(set),
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!approved) {
      return;
    }
    try {
      await engine.deleteSet(set.id, createId());
      onChanged();
    } catch (cause) {
      console.error(cause);
      setError(`Подход не удалён. ${describeFailure(cause)}`);
    }
  };

  return (
    <>
      {lastSets.length > 0 ? (
        <Panel>
          <AppText variant="heading">В прошлый раз</AppText>
          {lastSets.map((set) => (
            <AppText key={set.id} variant="callout" tone="secondary">
              {describeSet(set)}
            </AppText>
          ))}
        </Panel>
      ) : null}

      {suggestion !== null ? (
        <Panel>
          <AppText variant="heading">{`Попробовать ${formatWeight(suggestion)}?`}</AppText>
          <AppText variant="callout" tone="secondary">
            В прошлый раз вы сделали все подходы по плану, дошли до верха диапазона и оставили запас.
            Решение за вами.
          </AppText>
          <Button
            label="Подставить вес"
            variant="secondary"
            onPress={() => update({ weightText: formatInputNumber(suggestion) })}
          />
        </Panel>
      ) : null}

      {exercise.sets.length > 0 ? (
        <Panel>
          <AppText variant="heading">Записанные подходы</AppText>
          {exercise.sets.map((set) => (
            <View key={set.id} style={{ gap: theme.spacing.s }}>
              <AppText>{`${set.position}. ${describeSet(set)}`}</AppText>
              {paused ? null : (
                <View style={{ flexDirection: 'row', gap: theme.spacing.s }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Изменить"
                      variant="secondary"
                      disabled={saving}
                      onPress={() => startEditing(set)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Удалить"
                      variant="secondary"
                      disabled={saving || editing !== null}
                      onPress={() => remove(set)}
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </Panel>
      ) : null}

      {paused ? (
        <AppText tone="secondary">Тренировка на паузе. Продолжите её, чтобы записывать подходы.</AppText>
      ) : (
        <Panel>
          <AppText variant="heading">
            {editing ? `Подход ${editing.position}` : `Подход ${exercise.sets.length + 1}`}
          </AppText>
          <TextField
            hint="Оставьте пустым для упражнений со своим весом"
            keyboardType="decimal-pad"
            label="Вес, кг"
            onChangeText={(weightText) => update({ weightText })}
            value={form.weightText}
          />
          <TextField
            keyboardType="number-pad"
            label="Повторы"
            onChangeText={(repsText) => update({ repsText })}
            value={form.repsText}
          />
          <TextField
            hint="Сколько повторов вы могли бы ещё сделать. Необязательно"
            keyboardType="number-pad"
            label="Запас повторов"
            onChangeText={(rirText) => update({ rirText })}
            value={form.rirText}
          />
          <ChoiceGroup
            choices={setKinds.map((value) => ({ value, label: setKindLabels[value] }))}
            isSelected={(value) => form.kind === value}
            label="Тип подхода"
            onSelect={(kind) => update({ kind })}
          />
          <TextField
            label="Заметка"
            maxLength={200}
            onChangeText={(noteText) => update({ noteText })}
            value={form.noteText}
          />
          {error ? (
            <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger">
              {error}
            </AppText>
          ) : null}
          <Button
            label={editing ? 'Сохранить изменения' : 'Записать подход'}
            loading={saving}
            onPress={submit}
          />
          {editing ? (
            <Button label="Отмена" variant="secondary" disabled={saving} onPress={stopEditing} />
          ) : null}
        </Panel>
      )}
    </>
  );
}
