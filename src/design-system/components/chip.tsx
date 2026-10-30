import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '../theme-provider';
import { AppText } from './app-text';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  leading?: ReactNode;
};

export function Chip({ label, selected, onPress, leading }: ChipProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        alignItems: 'center',
        backgroundColor: selected ? colors.surfaceRaised : 'transparent',
        borderColor: selected ? colors.accent : colors.border,
        borderRadius: radii.chip,
        borderWidth: sizes.border,
        flexDirection: 'row',
        gap: spacing.s,
        minHeight: sizes.minTouch,
        paddingHorizontal: spacing.m,
      }}
    >
      {leading}
      <AppText variant="callout">{label}</AppText>
    </Pressable>
  );
}
