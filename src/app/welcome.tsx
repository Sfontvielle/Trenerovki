import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EnergyCore } from '@/components/energy-core';
import { AppText, Button, Screen, useTheme } from '@/design-system';

export default function WelcomeScreen() {
  const { theme } = useTheme();

  return (
    <Screen>
      <View style={[styles.hero, { gap: theme.spacing.xl }]}>
        <EnergyCore />
        <View style={[styles.copy, { gap: theme.spacing.s }]}>
          <AppText accessibilityRole="header" variant="display">
            IRONVANT
          </AppText>
          <AppText tone="secondary" style={styles.centered}>
            Персональный план, запись каждого подхода и прогресс, который хранится на вашем iPhone.
          </AppText>
        </View>
      </View>
      <Button label="Начать" onPress={() => router.push('/onboarding')} />
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
