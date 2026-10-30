import { useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, Panel, TextField, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { suggestNextWeight } from '@/domains/workout/progression';
import type { SessionExercise, SetInput, WorkoutSet } from '@/domains/workout/types';
import { validateSet } from '@/domains/workout/workout-engine';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, formatWeight, parseDecimal } from '@/lib/format';

type SetLoggerProps = {
  exercise: SessionExercise;
  lastSets: WorkoutSet[];
  paused: boolean;
  suggestionsAllowed: boolean;
  onChanged: () => void;
};

function describeSet(set: WorkoutSet) {
  const rir = set.rir === null ? '' : `, запас ${set.rir}`;
  return `${formatWeight(set.weightKg)} × ${set.reps}${rir}`;
}

function parseSet(weightText: string, repsText: string, rirText: string): SetInput | null {
  const input = {
    weightKg: parseDecimal(weightText),
    reps: parseDecimal(repsText) ?? Number.NaN,
    rir: parseDecimal(rirText),
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
  const [weightText, setWeightText] = useState(formatInputNumber(previous?.weightKg));
  const [repsText, setRepsText] = useState(formatInputNumber(previous?.reps));
  const [rirText, setRirText] = useState(formatInputNumber(previous?.rir));
  const [operationId, setOperationId] = useState(createId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fillForm = (set: WorkoutSet | undefined) => {
    setWeightText(formatInputNumber(set?.weightKg));
    setRepsText(formatInputNumber(set?.reps));
    setRirText(formatInputNumber(set?.rir));
    setError(null);
  };

  const startEditing = (set: WorkoutSet) => {
    setEditing(set);
    fillForm(set);
  };

  const stopEditing = () => {
    setEditing(null);
    fillForm(previous);
  };

  const submit = async () => {
    const input = parseSet(weightText, repsText, rirText);
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
            onPress={() => setWeightText(formatInputNumber(suggestion))}
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
            onChangeText={setWeightText}
            value={weightText}
          />
          <TextField
            keyboardType="number-pad"
            label="Повторы"
            onChangeText={setRepsText}
            value={repsText}
          />
          <TextField
            hint="Сколько повторов вы могли бы ещё сделать. Необязательно"
            keyboardType="number-pad"
            label="Запас повторов"
            onChangeText={setRirText}
            value={rirText}
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
