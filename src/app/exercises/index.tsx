import { router } from 'expo-router';

import { Button, Screen } from '@/design-system';
import { ExerciseList } from '@/features/exercises/exercise-list';
import { t } from '@/lib/i18n';

export default function ExerciseLibraryScreen() {
  return (
    <Screen scroll belowHeader>
      <Button label={t('Новое упражнение')} variant="secondary" onPress={() => router.push('/exercises/new')} />
      <ExerciseList onPick={(exerciseId) => router.push(`/exercises/${exerciseId}`)} />
    </Screen>
  );
}
