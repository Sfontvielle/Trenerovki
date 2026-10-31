import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';

import { EnergyCore } from '@/components/energy-core';
import { AppText, useTheme } from '@/design-system';

const PAUSE_MS = 900;

type PlanAnalysisProps = {
  onDone: () => void;
};

export function PlanAnalysis({ onDone }: PlanAnalysisProps) {
  const { theme } = useTheme();
  const animated = theme.motion.slow > 0;

  useEffect(() => {
    if (!animated) {
      onDone();
      return;
    }
    const timer = setTimeout(onDone, PAUSE_MS);
    return () => clearTimeout(timer);
  }, [animated, onDone]);

  return (
    <View accessibilityLiveRegion="polite" style={[styles.center, { gap: theme.spacing.xl }]}>
      <EnergyCore />
      <AppText accessibilityRole="header" variant="title" style={styles.title}>
        Составляем план по вашим ответам
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
});
