import { router } from 'expo-router';
import { useState } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, Icon, useTheme } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { type Tracking, exerciseName, exerciseTracking, findExercise } from '@/domains/exercises/catalog';
import { suggestNextSet } from '@/domains/workout/progression';
import { type SessionExercise, type SetInput, type SetKind, type WorkoutSet, setKinds } from '@/domains/workout/types';
import { restAfterSet, restTimer } from '@/features/workout/rest-store';
import { type SetFormValues, parseSetForm, setFormProblem, toSetForm } from '@/features/workout/set-form';
import { describeSuggestionShort, describeTarget, formatSeconds, groupLabel, setKindLabels } from '@/features/workout/set-labels';
import { describeFailure } from '@/lib/describe-failure';
import { formatInputNumber, formatNumber } from '@/lib/format';
import { successFeedback } from '@/lib/haptics';
import { t } from '@/lib/i18n';

const KEYBOARD_BAR_ID = 'set-keyboard-bar';

const kindMarks: Record<SetKind, string> = {
  working: '',
  warmup: t('Р'),
  drop: t('Д'),
  rest_pause: t('П'),
};

function describePrevious(set: WorkoutSet | undefined, tracking: Tracking) {
  if (!set) {
    return '—';
  }
  if (tracking === 'reps') {
    return `${set.weightKg === null ? '—' : formatNumber(set.weightKg)} × ${set.reps ?? '—'}`;
  }
  return set.durationSec === null ? '—' : formatSeconds(set.durationSec);
}

function savedValues(set: WorkoutSet, tracking: Tracking): SetFormValues {
  return { ...toSetForm(set, {}, tracking), kind: set.kind, noteText: set.note ?? '' };
}

function signatureOf(set: WorkoutSet | null) {
  return set ? [set.id, set.weightKg, set.reps, set.rir, set.kind, set.note, set.durationSec, set.distanceM].join(':') : '';
}

type CellProps = {
  label: string;
  value: string;
  placeholder: string;
  suggested: boolean;
  decimal?: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onDone: () => void;
};

function Cell({ label, value, placeholder, suggested, decimal = false, disabled, onChange, onDone }: CellProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, typography } = theme;

  return (
    <TextInput
      accessibilityLabel={label}
      editable={!disabled}
      inputAccessoryViewID={KEYBOARD_BAR_ID}
      keyboardAppearance={theme.mode}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      maxFontSizeMultiplier={theme.maxFontScale}
      maxLength={6}
      onChangeText={onChange}
      onEndEditing={onDone}
      placeholder={placeholder}
      placeholderTextColor={suggested ? colors.accent : colors.textSecondary}
      selectTextOnFocus
      selectionColor={colors.accent}
      style={[
        typography.scoreSmall,
        styles.cell,
        { backgroundColor: colors.background, borderRadius: radii.chip, color: colors.textPrimary, height: sizes.setCell },
      ]}
      value={value}
    />
  );
}

type SetRowProps = {
  number: number;
  tracking: Tracking;
  weighted: boolean;
  needsWeight: boolean;
  logged: WorkoutSet | null;
  previous: WorkoutSet | undefined;
  // The grey values a tap on the check records: today's set above, or last time's.
  basis: SetFormValues;
  suggested: boolean;
  paused: boolean;
  onLog: (input: SetInput, operationId: string) => Promise<boolean>;
  onUpdate: (setId: string, input: SetInput) => void;
  onUndo: (setId: string) => Promise<boolean>;
  onProblem: (problem: string) => void;
};

function SetRow({
  number,
  tracking,
  weighted,
  needsWeight,
  logged,
  previous,
  basis,
  suggested,
  paused,
  onLog,
  onUpdate,
  onUndo,
  onProblem,
}: SetRowProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;
  const signature = signatureOf(logged);
  const [draft, setDraft] = useState<{ signature: string; edits: Partial<SetFormValues> }>({ signature, edits: {} });
  const [operationId, setOperationId] = useState(createId);
  const [busy, setBusy] = useState(false);
  // Edits belong to the values they were made against, so a change saved from
  // the exercise screen shows up here instead of being hidden by them.
  const edits = draft.signature === signature ? draft.edits : {};
  const base = logged
    ? savedValues(logged, tracking)
    : { ...basis, weightText: '', repsText: '', durationText: '', distanceText: '' };
  const shown = { ...base, ...edits };
  const done = logged !== null;
  const update = (changes: Partial<SetFormValues>) => setDraft({ signature, edits: { ...edits, ...changes } });

  const complete = async () => {
    Keyboard.dismiss();
    setBusy(true);
    try {
      if (logged) {
        const values = savedValues(logged, tracking);
        if (await onUndo(logged.id)) {
          setDraft({ signature: '', edits: values });
        }
        return;
      }
      // An empty cell means "the same as shown in grey", so a repeat takes one tap.
      const filled = {
        ...shown,
        weightText: shown.weightText || basis.weightText,
        repsText: shown.repsText || basis.repsText,
        durationText: shown.durationText || basis.durationText,
        distanceText: shown.distanceText || basis.distanceText,
      };
      const input = parseSetForm(filled, tracking);
      if (needsWeight && !filled.weightText) {
        onProblem(t('Укажите вес. Для упражнений со своим весом поле можно оставить пустым.'));
      } else if (!input) {
        onProblem(setFormProblem(tracking));
      } else if (await onLog(input, operationId)) {
        setOperationId(createId());
      }
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = () => {
    if (!logged || Object.keys(edits).length === 0) {
      return;
    }
    const input = parseSetForm(shown, tracking);
    if (input) {
      onUpdate(logged.id, input);
    } else {
      onProblem(setFormProblem(tracking));
    }
  };

  const cycleKind = () => {
    const kind = setKinds[(setKinds.indexOf(shown.kind) + 1) % setKinds.length];
    const input = logged ? parseSetForm({ ...shown, kind }, tracking) : null;
    if (logged && input) {
      onUpdate(logged.id, input);
    } else if (!logged) {
      update({ kind });
    }
  };

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: done ? colors.accentSoft : 'transparent',
          borderRadius: radii.chip,
          gap: spacing.s,
          padding: spacing.xs,
        },
      ]}
    >
      <Pressable
        accessibilityHint={t('Меняет тип подхода')}
        accessibilityLabel={t('Подход {0}, {1}', { 0: number, 1: setKindLabels[shown.kind] })}
        accessibilityRole="button"
        disabled={paused}
        onPress={cycleKind}
        style={[styles.number, { minHeight: sizes.setCell, width: sizes.setNumber }]}
      >
        <AppText variant="scoreSmall" tone={shown.kind === 'working' ? 'secondary' : 'accent'}>
          {kindMarks[shown.kind] || number}
        </AppText>
      </Pressable>

      <View style={styles.previous}>
        <AppText variant="callout" tone="secondary" numberOfLines={1}>
          {describePrevious(previous, tracking)}
        </AppText>
      </View>

      {weighted ? (
        <Cell
          decimal
          disabled={paused}
          label={t('Подход {0}, вес', { 0: number })}
          onChange={(weightText) => update({ weightText })}
          onDone={saveEdit}
          placeholder={basis.weightText || '—'}
          suggested={suggested}
          value={shown.weightText}
        />
      ) : null}
      {tracking === 'reps' ? (
        <Cell
          disabled={paused}
          label={t('Подход {0}, повторы', { 0: number })}
          onChange={(repsText) => update({ repsText })}
          onDone={saveEdit}
          placeholder={basis.repsText || '—'}
          suggested={suggested}
          value={shown.repsText}
        />
      ) : (
        <Cell
          decimal={tracking === 'cardio'}
          disabled={paused}
          label={t('Подход {0}, время', { 0: number })}
          onChange={(durationText) => update({ durationText })}
          onDone={saveEdit}
          placeholder={basis.durationText || '—'}
          suggested={suggested}
          value={shown.durationText}
        />
      )}
      {tracking === 'cardio' ? (
        <Cell
          decimal
          disabled={paused}
          label={t('Подход {0}, дистанция', { 0: number })}
          onChange={(distanceText) => update({ distanceText })}
          onDone={saveEdit}
          placeholder={basis.distanceText || '—'}
          suggested={false}
          value={shown.distanceText}
        />
      ) : null}

      <Pressable
        accessibilityLabel={done ? t('Отменить подход {0}', { 0: number }) : t('Записать подход {0}', { 0: number })}
        accessibilityRole="button"
        accessibilityState={{ checked: done, disabled: paused }}
        disabled={paused || busy}
        onPress={complete}
        style={[
          styles.check,
          {
            backgroundColor: done ? colors.accent : colors.surfaceRaised,
            borderRadius: radii.chip,
            height: sizes.setCell,
            opacity: paused ? 0.4 : 1,
            width: sizes.setCheck,
          },
        ]}
      >
        <Icon color={done ? colors.onAccent : colors.textSecondary} glyph="✓" name="checkmark" />
      </Pressable>
    </View>
  );
}

// The number pad has no return key, so this bar is the way to close it.
export function SetKeyboardBar() {
  const { theme } = useTheme();

  if (Platform.OS !== 'ios') {
    return null;
  }
  return (
    <InputAccessoryView nativeID={KEYBOARD_BAR_ID}>
      <View style={{ alignItems: 'flex-end', backgroundColor: theme.colors.surfaceRaised, paddingHorizontal: theme.spacing.s }}>
        <Button label={t('Готово')} variant="plain" onPress={Keyboard.dismiss} />
      </View>
    </InputAccessoryView>
  );
}

type ExerciseBlockProps = {
  exercise: SessionExercise;
  exercises: SessionExercise[];
  recentSets: WorkoutSet[][];
  paused: boolean;
  suggestionsAllowed: boolean;
  onChanged: () => void;
};

export function ExerciseBlock({ exercise, exercises, recentSets, paused, suggestionsAllowed, onChanged }: ExerciseBlockProps) {
  const { engine } = useAppData();
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;
  const [extraRows, setExtraRows] = useState(0);
  const [suggestionTaken, setSuggestionTaken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tracking = exerciseTracking(exercise.exerciseId);
  const details = findExercise(exercise.exerciseId);
  const lastSets = recentSets[0] ?? [];
  const groupSize = exercise.groupId ? exercises.filter(({ groupId }) => groupId === exercise.groupId).length : 0;
  const planned = exercise.plannedSets ?? Math.max(lastSets.length, exercise.sets.length + 1);
  const rowCount = Math.max(planned + extraRows, exercise.sets.length);
  // Stretching is done for time and with no extra load.
  const weighted = tracking === 'reps' || (tracking === 'duration' && details?.category !== 'mobility');
  const bodyweightAllowed = details?.equipment.includes('bodyweight') ?? true;
  const progressive = tracking !== 'cardio' && details?.category !== 'mobility';
  const suggestion =
    suggestionsAllowed && progressive && exercise.sets.length === 0 ? suggestNextSet(recentSets, exercise) : null;
  const target = describeTarget({
    sets: exercise.plannedSets,
    repsMin: exercise.repsMin,
    repsMax: exercise.repsMax,
    durationSec: exercise.targetDurationSec,
  });
  const subtitle = [groupSize > 1 ? groupLabel(groupSize) : null, target].filter(Boolean).join(', ');

  const log = async (input: SetInput, operationId: string) => {
    setError(null);
    try {
      await engine.logSet(exercise.id, input, operationId);
      successFeedback();
      restAfterSet(exercise, exercises, input.kind ?? 'working');
      onChanged();
      return true;
    } catch (cause) {
      console.error(cause);
      setError(t('Подход не сохранён. {0}', { 0: describeFailure(cause) }));
      return false;
    }
  };

  const update = (setId: string, input: SetInput) => {
    setError(null);
    engine
      .updateSet(setId, input, createId())
      .then(onChanged)
      .catch((cause: unknown) => {
        console.error(cause);
        setError(t('Подход не сохранён. {0}', { 0: describeFailure(cause) }));
      });
  };

  const undo = async (setId: string) => {
    setError(null);
    try {
      await engine.deleteSet(setId, createId());
      restTimer.stop();
      onChanged();
      return true;
    } catch (cause) {
      console.error(cause);
      setError(t('Подход не удалён. {0}', { 0: describeFailure(cause) }));
      return false;
    }
  };

  const basisFor = (index: number) => {
    const form = toSetForm(
      exercise.sets[index - 1] ?? lastSets[index] ?? lastSets.at(-1),
      { reps: exercise.repsMin, durationSec: exercise.targetDurationSec },
      tracking,
    );
    return suggestion && suggestionTaken
      ? {
          ...form,
          weightText: suggestion.weightKg === null ? form.weightText : formatInputNumber(suggestion.weightKg),
          repsText: suggestion.reps === null ? form.repsText : formatInputNumber(suggestion.reps),
          durationText: suggestion.durationSec === null ? form.durationText : formatInputNumber(suggestion.durationSec),
        }
      : form;
  };

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderLeftColor: colors.accent,
        borderLeftWidth: groupSize > 1 ? sizes.groupRail : 0,
        borderRadius: radii.panel,
        gap: spacing.s,
        padding: spacing.m,
      }}
    >
      <Pressable
        accessibilityHint={t('Открывает подробности упражнения')}
        accessibilityRole="button"
        onPress={() => router.push(`/workout/${exercise.id}`)}
        style={[styles.header, { gap: spacing.s, minHeight: sizes.minTouch }]}
      >
        <View style={styles.headerText}>
          <AppText variant="heading">{exerciseName(exercise.exerciseId)}</AppText>
          {subtitle ? (
            <AppText variant="caption" tone="secondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Icon glyph="›" name="chevron.right" size={sizes.chevron} />
      </Pressable>

      {suggestion ? (
        <Pressable
          accessibilityHint={t('Подставляет значения в таблицу')}
          accessibilityRole="button"
          accessibilityState={{ selected: suggestionTaken }}
          disabled={paused}
          onPress={() => setSuggestionTaken((current) => !current)}
          style={{ justifyContent: 'center', minHeight: sizes.minTouch }}
        >
          <AppText variant="callout" tone="accent">
            {describeSuggestionShort(suggestion)}
          </AppText>
        </Pressable>
      ) : null}

      <View style={[styles.row, { gap: spacing.s, paddingHorizontal: spacing.xs }]}>
        <View style={{ width: sizes.setNumber }} />
        <AppText variant="caption" tone="secondary" style={styles.previous}>
          {t('Прошлый раз')}
        </AppText>
        {weighted ? (
          <AppText variant="caption" tone="secondary" style={styles.columnTitle}>
            {t('кг')}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="secondary" style={styles.columnTitle}>
          {tracking === 'reps' ? t('повт.') : tracking === 'cardio' ? t('мин') : t('сек')}
        </AppText>
        {tracking === 'cardio' ? (
          <AppText variant="caption" tone="secondary" style={styles.columnTitle}>
            {t('км')}
          </AppText>
        ) : null}
        <View style={{ width: sizes.setCheck }} />
      </View>

      {Array.from({ length: rowCount }, (_, index) => (
        <SetRow
          key={index}
          basis={basisFor(index)}
          logged={exercise.sets[index] ?? null}
          needsWeight={weighted && !bodyweightAllowed}
          number={index + 1}
          onLog={log}
          onProblem={setError}
          onUndo={undo}
          onUpdate={update}
          paused={paused}
          previous={lastSets[index] ?? lastSets.at(-1)}
          suggested={suggestion !== null && suggestionTaken}
          tracking={tracking}
          weighted={weighted}
        />
      ))}

      {error ? (
        <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger">
          {error}
        </AppText>
      ) : null}

      {paused ? null : (
        <Button label={t('Добавить подход')} variant="plain" onPress={() => setExtraRows((current) => current + 1)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  check: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnTitle: {
    flex: 1,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerText: {
    flex: 1,
  },
  number: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previous: {
    flex: 1.3,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
