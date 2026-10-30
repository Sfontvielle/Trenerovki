import { useState } from 'react';
import { ActivityIndicator, Animated, Pressable } from 'react-native';

import { useTheme } from '../theme-provider';
import { AppText } from './app-text';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const { theme } = useTheme();
  const { colors, motion, radii, shadows, sizes, spacing } = theme;
  const [scale] = useState(() => new Animated.Value(1));
  const filled = variant === 'primary' && !disabled;
  const inactive = disabled || loading;
  const secondaryForeground = disabled ? colors.textSecondary : colors.textPrimary;
  const foreground = filled ? colors.onAccent : secondaryForeground;

  const animateTo = (toValue: number) => {
    Animated.timing(scale, {
      toValue,
      duration: motion.fast,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={() => animateTo(motion.pressScale)}
        onPressOut={() => animateTo(1)}
        style={{
          alignItems: 'center',
          backgroundColor: filled ? colors.accent : colors.surfaceRaised,
          borderRadius: radii.control,
          boxShadow: filled && !loading ? shadows.glow : undefined,
          flexDirection: 'row',
          gap: spacing.s,
          justifyContent: 'center',
          minHeight: sizes.control,
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.m,
        }}
      >
        {loading ? <ActivityIndicator color={foreground} /> : null}
        <AppText variant="button" style={{ color: foreground }}>
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
