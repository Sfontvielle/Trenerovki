import { router } from 'expo-router';

import { AppText, Button, Panel } from '@/design-system';
import type { WorkoutSession } from '@/domains/workout/types';
import { t } from '@/lib/i18n';

type OpenSessionBannerProps = {
  session: WorkoutSession;
};

export function OpenSessionBanner({ session }: OpenSessionBannerProps) {
  return (
    <Panel>
      <AppText variant="heading">
        {session.recoveryRequired ? t('Тренировка была прервана') : t('Тренировка не завершена')}
      </AppText>
      <AppText tone="secondary">
        {t('{0}. Записанные подходы сохранены.', { 0: session.title })}
      </AppText>
      <Button label={t('Продолжить тренировку')} onPress={() => router.push('/workout')} />
    </Panel>
  );
}
