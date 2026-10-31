import { useState } from 'react';
import { View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, Panel, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { exerciseTracking } from '@/domains/exercises/catalog';
import { type Suggestion, suggestNextSet } from '@/domains/workout/progression';
import type { SessionExercise, WorkoutSet } from '@/domains/workout/types';
import { SetFields, type SetFormValues, parseSetForm, setFormProblem, toSetForm } from '@/features/workout/set-form';
import { describeSet, formatSeconds } from '@/features/workout/set-labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, formatWeight } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';
import { t } from '@/lib/i18n';

type SetLoggerProps = {
  exercise: SessionExercise;
  recentSets: WorkoutSet[][];
  paused: boolean;
  suggestionsAllowed: boolean;
  onChanged: () => void;
};

function describeSuggestion({ kind, weightKg, reps, durationSec }: Suggestion) {
  switch (kind) {
    case 'add_weight':
      return {
        title: t('Попробовать {0}?', { 0: formatWeight(weightKg) }),
        body: t('В прошлый раз все подходы дошли до верха диапазона с запасом. Начните с {0} повторов. Решение за вами.', { 0: reps }),
      };
    case 'add_rep':
      return {
        title: t('Попробовать {0} повторов?', { 0: reps }),
        body: t('Вес тот же, цель на один повтор выше. Решение за вами.'),
      };
    case 'add_time':
      return {
        title: t('Попробовать {0}?', { 0: formatSeconds(durationSec as number) }),
        body: t('Прошлые подходы выполнены полностью, можно добавить немного времени. Решение за вами.'),
      };
    case 'reduce_weight':
      return {
        title: t('Снизить вес до {0}?', { 0: formatWeight(weightKg) }),
        body: t('Две тренировки подряд повторов было меньше плана. Небольшое снижение поможет вернуться в диапазон. Решение за вами.'),
      };
    default:
      return {
        title: weightKg === null ? t('Повторите прошлый результат') : t('Оставить {0}', { 0: formatWeight(weightKg) }),
        body: t('Прибавлять пока рано: сначала уверенно выполните все подходы с запасом. Решение за вами.'),
      };
  }
}

export function SetLogger({ exercise, recentSets, paused, suggestionsAllowed, onChanged }: SetLoggerProps) {
  const { engine } = useAppData();
  const { theme } = useTheme();
  const tracking = exerciseTracking(exercise.exerciseId);
  const lastSets = recentSets[0] ?? [];
  const previous = exercise.sets.at(-1) ?? lastSets[exercise.sets.length] ?? lastSets.at(-1);
  const prefill = { reps: exercise.repsMin, durationSec: exercise.targetDurationSec };
  const suggestion =
    suggestionsAllowed && exercise.sets.length === 0 ? suggestNextSet(recentSets, exercise) : null;
  const advice = suggestion ? describeSuggestion(suggestion) : null;

  const [editing, setEditing] = useState<WorkoutSet | null>(null);
  const [form, setForm] = useState(() => toSetForm(previous, prefill, tracking));
  const [operationId, setOperationId] = useState(createId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (changes: Partial<SetFormValues>) => setForm((current) => ({ ...current, ...changes }));

  const startEditing = (set: WorkoutSet) => {
    setEditing(set);
    setForm({ ...toSetForm(set, {}, tracking), kind: set.kind, noteText: set.note ?? '' });
    setError(null);
  };

  const stopEditing = () => {
    setEditing(null);
    setForm(toSetForm(previous, prefill, tracking));
    setError(null);
  };

  const submit = async () => {
    const input = parseSetForm(form, tracking);
    if (!input) {
      setError(setFormProblem(tracking));
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
      setError(t('Подход не сохранён. {0}', { 0: describeFailure(cause) }));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (set: WorkoutSet) => {
    const approved = await confirm({
      title: t('Удалить подход?'),
      message: describeSet(set),
      confirmLabel: t('Удалить'),
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
      setError(t('Подход не удалён. {0}', { 0: describeFailure(cause) }));
    }
  };

  return (
    <>
      {lastSets.length > 0 ? (
        <Panel>
          <AppText variant="heading">{t('В прошлый раз')}</AppText>
          {lastSets.map((set) => (
            <AppText key={set.id} variant="callout" tone="secondary">
              {describeSet(set)}
            </AppText>
          ))}
        </Panel>
      ) : null}

      {suggestion && advice ? (
        <Panel>
          <AppText variant="heading">{advice.title}</AppText>
          <AppText variant="callout" tone="secondary">
            {advice.body}
          </AppText>
          <Button
            label={t('Подставить значения')}
            variant="secondary"
            onPress={() =>
              update({
                ...(suggestion.weightKg === null ? {} : { weightText: formatInputNumber(suggestion.weightKg) }),
                ...(suggestion.reps === null ? {} : { repsText: formatInputNumber(suggestion.reps) }),
                ...(suggestion.durationSec === null
                  ? {}
                  : { durationText: formatInputNumber(suggestion.durationSec) }),
              })
            }
          />
        </Panel>
      ) : null}

      {exercise.sets.length > 0 ? (
        <Panel>
          <AppText variant="heading">{t('Записанные подходы')}</AppText>
          {exercise.sets.map((set) => (
            <View key={set.id} style={{ gap: theme.spacing.s }}>
              <AppText>{`${set.position}. ${describeSet(set)}`}</AppText>
              {paused ? null : (
                <View style={{ flexDirection: 'row', gap: theme.spacing.s }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('Изменить')}
                      variant="secondary"
                      disabled={saving}
                      onPress={() => startEditing(set)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      label={t('Удалить')}
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
        <AppText tone="secondary">{t('Тренировка на паузе. Продолжите её, чтобы записывать подходы.')}</AppText>
      ) : (
        <Panel>
          <AppText variant="heading">
            {editing ? t('Подход {0}', { 0: editing.position }) : t('Подход {0}', { 0: exercise.sets.length + 1 })}
          </AppText>
          <SetFields form={form} tracking={tracking} onChange={update} />
          {error ? (
            <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger">
              {error}
            </AppText>
          ) : null}
          <Button
            label={editing ? t('Сохранить изменения') : t('Записать подход')}
            loading={saving}
            onPress={submit}
          />
          {editing ? (
            <Button label={t('Отмена')} variant="secondary" disabled={saving} onPress={stopEditing} />
          ) : null}
        </Panel>
      )}
    </>
  );
}
