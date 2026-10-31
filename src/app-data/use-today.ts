import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { dayKey } from '@/domains/nutrition/nutrition';

export function useToday() {
  const { resumeCount } = useAppData();
  const [today, setToday] = useState(() => dayKey(new Date()));

  useFocusEffect(
    useCallback(() => {
      setToday(dayKey(new Date()));
      // eslint-disable-next-line react-hooks/exhaustive-deps -- resumeCount re-reads the date.
    }, [resumeCount]),
  );

  return today;
}
