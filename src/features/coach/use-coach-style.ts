import { useCallback, useEffect, useState } from 'react';

import { useAppData } from '@/app-data/app-data';

const DETAIL_KEY = 'coach_detail';

export type CoachDetail = 'detailed' | 'brief';

export function useCoachStyle() {
  const { settings } = useAppData();
  const [detail, setDetail] = useState<CoachDetail>('detailed');

  useEffect(() => {
    let active = true;
    settings
      .get(DETAIL_KEY)
      .then((stored) => {
        if (active && stored === 'brief') {
          setDetail('brief');
        }
      })
      .catch(console.error);
    return () => {
      active = false;
    };
  }, [settings]);

  const changeDetail = useCallback(
    async (next: CoachDetail) => {
      setDetail(next);
      await settings.set(DETAIL_KEY, next);
    },
    [settings],
  );

  return { detail, detailed: detail === 'detailed', changeDetail };
}
