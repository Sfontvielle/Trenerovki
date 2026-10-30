import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useTheme } from '@/design-system';

export function EnergyCore() {
  const { theme } = useTheme();
  const { colors, motion, radii, shadows, sizes } = theme;
  const [pulse] = useState(() => new Animated.Value(0));
  const duration = motion.slow * 3;

  useEffect(() => {
    if (duration === 0) {
      pulse.setValue(1);
      return;
    }
    const easing = Easing.inOut(Easing.ease);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration, easing, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration, easing, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [duration, pulse]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.center, { height: sizes.coreOuter, width: sizes.coreOuter }]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            borderColor: colors.accent,
            borderRadius: radii.full,
            borderWidth: sizes.border,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
          },
        ]}
      />
      <View
        style={{
          backgroundColor: colors.accent,
          borderRadius: radii.full,
          boxShadow: shadows.glow,
          height: sizes.coreInner,
          width: sizes.coreInner,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
