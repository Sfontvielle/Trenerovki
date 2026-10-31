import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { ChoiceGroup } from '@/components/choice-group';
import { AppText, Button, Screen, TextField } from '@/design-system';
import { type MuscleGroup, type Tracking, muscleGroupLabels } from '@/domains/exercises/catalog';
import { addCustomExercise } from '@/domains/exercises/custom-exercise-repository';
import { createId } from '@/domains/data-platform/ids';
import { describeFailure } from '@/lib/describe-failure';
import { t } from '@/lib/i18n';

const muscleGroups = Object.keys(muscleGroupLabels) as MuscleGroup[];
const trackingChoices: { value: Tracking; label: string }[] = [
  { value: 'reps', label: t('Повторы') },
  { value: 'duration', label: t('Время') },
  { value: 'cardio', label: t('Кардио') },
];

export default function NewExerciseScreen() {
  const { database, reloadAll } = useAppData();
  const [name, setName] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | null>(null);
  const [tracking, setTracking] = useState<Tracking>('reps');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !muscleGroup) {
      setError(t('Укажите название и группу мышц.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addCustomExercise(database, { id: createId(), name, muscleGroup, tracking, equipment: [] }, new Date());
      await reloadAll();
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(t('Упражнение не сохранено. {0}', { 0: describeFailure(cause) }));
      setSaving(false);
    }
  };

  return (
    <Screen scroll belowHeader>
      <TextField label={t('Название')} maxLength={60} onChangeText={setName} value={name} />
      <ChoiceGroup
        choices={muscleGroups.map((value) => ({ value, label: muscleGroupLabels[value] }))}
        isSelected={(value) => muscleGroup === value}
        label={t('Группа мышц')}
        onSelect={setMuscleGroup}
      />
      <ChoiceGroup
        choices={trackingChoices}
        isSelected={(value) => tracking === value}
        label={t('Что записывать')}
        onSelect={setTracking}
      />
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <Button label={t('Сохранить упражнение')} loading={saving} onPress={save} />
    </Screen>
  );
}
