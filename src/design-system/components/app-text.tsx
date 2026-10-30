import { Text, type TextProps } from 'react-native';

import { useTheme } from '../theme-provider';
import type { StatusTone, TypographyVariant } from '../tokens';

type AppTextProps = TextProps & {
  variant?: TypographyVariant;
  tone?: 'primary' | 'secondary' | 'accent' | StatusTone;
};

export function AppText({ variant = 'body', tone = 'primary', style, ...props }: AppTextProps) {
  const { theme } = useTheme();
  const { colors } = theme;
  const toneColors = {
    primary: colors.textPrimary,
    secondary: colors.textSecondary,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    info: colors.info,
  };

  return (
    <Text
      maxFontSizeMultiplier={theme.maxFontScale}
      style={[theme.typography[variant], { color: toneColors[tone] }, style]}
      {...props}
    />
  );
}
