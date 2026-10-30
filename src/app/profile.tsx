import { router } from 'expo-router';

import { SectionPlaceholder } from '@/components/section-placeholder';
import { AppText, Button, Screen } from '@/design-system';

export default function ProfileScreen() {
  return (
    <Screen scroll>
      <AppText variant="title">Профиль</AppText>
      <SectionPlaceholder description="Здесь будут ваши данные, цели, настройки и управление приватностью." />
      {__DEV__ ? (
        <Button
          label="Открыть дизайн-систему"
          variant="secondary"
          onPress={() => router.push('/design-system')}
        />
      ) : null}
      <Button label="Закрыть" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
