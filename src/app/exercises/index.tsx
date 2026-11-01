import { router } from 'expo-router';

import { Button, Screen } from '@/design-system';
import { ExerciseList } from '@/features/exercises/exercise-list';
import { t } from '@/lib/i18n';

export default function ExerciseLibraryScreen() {
  return (
    <Screen scroll belowHeader>
      <ExerciseList onPick={(exerciseId) => router.push(`/exercises/${exerciseId}`)} />
      <Button label={t('Новое упражнение')} variant="plain" onPress={() => router.push('/exercises/new')} />
    </Screen>
  );
}
