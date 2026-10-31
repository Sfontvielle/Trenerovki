import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EnergyCore } from '@/components/energy-core';
import { AppText, useTheme } from '@/design-system';

const CHECK_STEP_MS = 280;
const considered = ['Цель и опыт', 'Режим и условия', 'Ограничения'];

type PlanAnalysisProps = {
  onDone: () => void;
};

export function PlanAnalysis({ onDone }: PlanAnalysisProps) {
  const { theme } = useTheme();
  const { spacing } = theme;
  const animated = theme.motion.slow > 0;
  const [checked, setChecked] = useState(0);

  useEffect(() => {
    if (!animated) {
      onDone();
      return;
    }
    const timers = considered.map((_, index) =>
      setTimeout(() => setChecked(index + 1), CHECK_STEP_MS * (index + 1)),
    );
    timers.push(setTimeout(onDone, CHECK_STEP_MS * (considered.length + 1)));
    return () => timers.forEach(clearTimeout);
  }, [animated, onDone]);

  return (
    <View accessibilityLiveRegion="polite" style={[styles.center, { gap: spacing.xl }]}>
      <EnergyCore />
      <AppText accessibilityRole="header" variant="title">
        Подбираем план
      </AppText>
      <View style={{ gap: spacing.s }}>
        {considered.map((item, index) => (
          <AppText key={item} tone={index < checked ? 'accent' : 'secondary'}>
            {`${index < checked ? '✓' : '○'} ${item}`}
          </AppText>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
