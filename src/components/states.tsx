import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';

import type { ScreenData } from '@/app-data/use-screen-data';
import { AppText, Button, Panel, useTheme } from '@/design-system';
import { t } from '@/lib/i18n';

export function LoadingState() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityLabel={t('Загрузка')}
      accessibilityRole="progressbar"
      style={{ padding: theme.spacing.xxl }}
    >
      <ActivityIndicator color={theme.colors.accent} />
    </View>
  );
}

type ErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <Panel>
      <AppText variant="heading">{t('Не удалось загрузить данные')}</AppText>
      <AppText tone="secondary">{message}</AppText>
      <Button label={t('Повторить')} variant="secondary" onPress={onRetry} />
    </Panel>
  );
}

type DataViewProps<Data> = {
  state: ScreenData<Data>;
  children: (data: Data) => ReactNode;
};

export function DataView<Data>({ state, children }: DataViewProps<Data>) {
  if (state.status === 'loading') {
    return <LoadingState />;
  }
  if (state.status === 'error') {
    return (
      <ErrorState
        message={t('Ваши данные остаются на устройстве. Попробуйте ещё раз.')}
        onRetry={state.reload}
      />
    );
  }
  return <>{children(state.data)}</>;
}
