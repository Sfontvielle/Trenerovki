import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

type LoadResult<Data> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: Data };

export type ScreenData<Data> = LoadResult<Data> & { reload: () => void };

export function useScreenData<Data>(load: () => Promise<Data>): ScreenData<Data> {
  const [result, setResult] = useState<LoadResult<Data>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      load().then(
        (data) => {
          if (active) {
            setResult({ status: 'ready', data });
          }
        },
        (error: unknown) => {
          console.error(error);
          if (active) {
            setResult({ status: 'error' });
          }
        },
      );
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- attempt re-runs the load.
    }, [load, attempt]),
  );

  const reload = useCallback(() => setAttempt((current) => current + 1), []);
  return { ...result, reload };
}
