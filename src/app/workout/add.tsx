import { router } from 'expo-router';
import { useRef, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { AppText, Screen } from '@/design-system';
import { createId } from '@/domains/data-platform/ids';
import { ExerciseList } from '@/features/exercises/exercise-list';
import { describeFailure } from '@/lib/describe-failure';

export default function AddExerciseScreen() {
  const { engine } = useAppData();
  const [error, setError] = useState<string | null>(null);
  const adding = useRef(false);

  const add = async (exerciseId: string) => {
    if (adding.current) {
      return;
    }
    adding.current = true;
    setError(null);
    try {
      const session = await engine.getOpenSession();
      if (!session) {
        setError('Нет открытой тренировки.');
        return;
      }
      await engine.addExercise(session.id, exerciseId, createId());
      router.back();
    } catch (cause) {
      console.error(cause);
      setError(`Упражнение не добавлено. ${describeFailure(cause)}`);
    } finally {
      adding.current = false;
    }
  };

  return (
    <Screen scroll belowHeader>
      {error ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {error}
        </AppText>
      ) : null}
      <ExerciseList onPick={add} />
    </Screen>
  );
}
