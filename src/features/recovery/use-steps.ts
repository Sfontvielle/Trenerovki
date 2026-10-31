import { useFocusEffect } from 'expo-router';
import { Pedometer } from 'expo-sensors';
import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { dayKey } from '@/domains/nutrition/nutrition';
import { saveSteps } from '@/domains/recovery/recovery-repository';

const DAYS_READ = 7;

export type StepsState =
  | { status: 'loading' | 'unavailable' | 'needs_permission' | 'denied' }
  | { status: 'ready'; today: number };

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// iOS keeps step counts for the last seven days, so each visit stores them all
// and the history survives past that window.
export function useSteps() {
  const { database, resumeCount } = useAppData();
  const [state, setState] = useState<StepsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function read() {
        try {
          if (!(await Pedometer.isAvailableAsync())) {
            return { status: 'unavailable' } as const;
          }
          const permission = await Pedometer.getPermissionsAsync();
          if (!permission.granted) {
            return { status: permission.canAskAgain ? 'needs_permission' : 'denied' } as const;
          }

          const now = new Date();
          let today = 0;
          for (let offset = 0; offset < DAYS_READ; offset += 1) {
            const start = startOfDay(now);
            start.setDate(start.getDate() - offset);
            const end = new Date(start);
            end.setDate(end.getDate() + 1);
            const { steps } = await Pedometer.getStepCountAsync(start, end < now ? end : now);
            await saveSteps(database, dayKey(start), steps, now);
            if (offset === 0) {
              today = steps;
            }
          }
          return { status: 'ready', today } as const;
        } catch (error) {
          console.error(error);
          return { status: 'unavailable' } as const;
        }
      }

      read().then((next) => {
        if (active) {
          setState(next);
        }
      });
      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- resumeCount and attempt re-read the steps.
    }, [database, resumeCount, attempt]),
  );

  const requestAccess = useCallback(async () => {
    try {
      await Pedometer.requestPermissionsAsync();
    } catch (error) {
      console.error(error);
    }
    setAttempt((current) => current + 1);
  }, []);

  return { state, requestAccess };
}
