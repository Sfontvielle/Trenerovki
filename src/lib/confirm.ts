import { Alert, Platform } from 'react-native';
import { t } from '@/lib/i18n';

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
};

export function confirm({ title, message, confirmLabel, destructive = false }: ConfirmOptions) {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n${message}`));
  }

  return new Promise<boolean>((resolve) => {
    Alert.alert(title, message, [
      { text: t('Не сейчас'), style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}
