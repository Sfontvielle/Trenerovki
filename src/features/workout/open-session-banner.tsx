import { router } from 'expo-router';

import { AppText, Button, Panel } from '@/design-system';
import type { WorkoutSession } from '@/domains/workout/types';

type OpenSessionBannerProps = {
  session: WorkoutSession;
};

export function OpenSessionBanner({ session }: OpenSessionBannerProps) {
  return (
    <Panel>
      <AppText variant="heading">Тренировка не завершена</AppText>
      <AppText tone="secondary">
        {`${session.title}. Записанные подходы сохранены.`}
      </AppText>
      <Button label="Продолжить тренировку" onPress={() => router.push('/workout')} />
    </Panel>
  );
}
