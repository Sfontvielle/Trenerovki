import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { BrandMark } from '@/components/brand-mark';
import { AppText, Button, Screen, useTheme } from '@/design-system';
import { t } from '@/lib/i18n';

const MARK_SIZE = 160;

export default function WelcomeScreen() {
  const { theme } = useTheme();

  return (
    <Screen ambient>
      <View style={[styles.hero, { gap: theme.spacing.xl }]}>
        <BrandMark size={MARK_SIZE} wordmark />
        <View style={[styles.copy, { gap: theme.spacing.s }]}>
          <AppText tone="secondary" style={styles.centered}>
            {t('План под вашу цель, запись каждого подхода и прогресс в одном приложении.')}
          </AppText>
          <AppText variant="callout" tone="secondary" style={styles.centered}>
            {t('Coach считает подсказки по вашим записям и ничего не меняет без вашего согласия.')}
          </AppText>
        </View>
      </View>
      <Button label={t('Начать')} onPress={() => router.push('/onboarding')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: {
    textAlign: 'center',
  },
  copy: {
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
