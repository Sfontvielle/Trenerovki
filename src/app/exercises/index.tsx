import { router } from 'expo-router';

import { Button, Screen } from '@/design-system';
import { ExerciseList } from '@/features/exercises/exercise-list';

export default function ExerciseLibraryScreen() {
  return (
    <Screen scroll belowHeader>
      <Button label="Новое упражнение" variant="secondary" onPress={() => router.push('/exercises/new')} />
      <ExerciseList onPick={(exerciseId) => router.push(`/exercises/${exerciseId}`)} />
    </Screen>
  );
}
