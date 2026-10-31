import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { DataView } from '@/components/states';
import { AppText, Button, Panel, Screen } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { exerciseName, exerciseTracking } from '@/domains/exercises/catalog';
import type { WorkoutSet } from '@/domains/workout/types';
import { SetFields, type SetFormValues, parseSetForm, setFormProblem, toSetForm } from '@/features/workout/set-form';
import { describeSet } from '@/features/workout/set-labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';

type SetEditorProps = {
  set: WorkoutSet;
  exerciseId: string;
};

function SetEditor({ set, exerciseId }: SetEditorProps) {
  const { engine } = useAppData();
  const tracking = exerciseTracking(exerciseId);
  const [form, setForm] = useState<SetFormValues>(() => ({
    ...toSetForm(set, {}, tracking),
    kind: set.kind,
    noteText: set.note ?? '',
  }));
  const [operationId] = useState(createId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const input = parseSetForm(form, tracking);
    if (!input) {
      setError(setFormProblem(tracking));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await engine.correctCompletedSet(set.id, input, operationId);
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Исправление не сохранено. ${describeFailure(cause)}`);
      setSaving(false);
    }
  };

  const remove = async () => {
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
      await engine.deleteCompletedSet(set.id, createId());
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Подход не удалён. ${describeFailure(cause)}`);
    }
  };

  return (
    <>
      <AppText accessibilityRole="header" variant="title">
        {exerciseName(exerciseId)}
      </AppText>
      <Panel>
        <SetFields form={form} tracking={tracking} onChange={(changes) => setForm((current) => ({ ...current, ...changes }))} />
        {error ? (
          <AppText accessibilityLiveRegion="polite" variant="callout" tone="danger">
            {error}
          </AppText>
        ) : null}
        <Button label="Сохранить исправление" loading={saving} onPress={save} />
      </Panel>
      <Button label="Удалить подход" variant="secondary" disabled={saving} onPress={remove} />
    </>
  );
}

export default function EditCompletedSetScreen() {
  const { setId } = useLocalSearchParams<{ setId: string }>();
  const { engine } = useAppData();
  const load = useCallback(() => engine.getCompletedSet(setId), [engine, setId]);
  const state = useScreenData(load);

  return (
    <Screen scroll belowHeader>
      <DataView state={state}>
        {(found) =>
          found ? (
            <SetEditor set={found.set} exerciseId={found.exerciseId} />
          ) : (
            <AppText tone="secondary">Этого подхода больше нет.</AppText>
          )
        }
      </DataView>
    </Screen>
  );
}
