import { View } from 'react-native';

import { useTheme } from '@/design-system';

type ProgressLineProps = {
  ratio: number;
  label: string;
};

export function ProgressLine({ ratio, label }: ProgressLineProps) {
  const { theme } = useTheme();
  const { colors, radii, spacing } = theme;
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{ backgroundColor: colors.border, borderRadius: radii.full, height: spacing.s, overflow: 'hidden' }}
    >
      <View style={{ backgroundColor: colors.accent, height: '100%', width: `${percent}%` }} />
    </View>
  );
}
