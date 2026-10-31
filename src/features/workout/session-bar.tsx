import { router } from 'expo-router';
import { useCallback } from 'react';

import { useAppData } from '@/app-data/app-data';
import { useScreenData } from '@/app-data/use-screen-data';
import { Button } from '@/design-system';
import { t } from '@/lib/i18n';

export function SessionBar() {
  const { engine } = useAppData();
  const load = useCallback(() => engine.getOpenSession(), [engine]);
  const state = useScreenData(load);

  if (state.status !== 'ready' || !state.data) {
    return null;
  }
  return <Button label={t('Вернуться к тренировке')} onPress={() => router.push('/workout')} />;
}
