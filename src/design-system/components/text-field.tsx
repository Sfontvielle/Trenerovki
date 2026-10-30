import { TextInput, type TextInputProps, View } from 'react-native';

import { useTheme } from '../theme-provider';
import { AppText } from './app-text';

type TextFieldProps = TextInputProps & {
  label: string;
  hint?: string;
  error?: string | null;
};

export function TextField({ label, hint, error, style, ...props }: TextFieldProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing, typography } = theme;

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="callout" tone="secondary">
        {label}
      </AppText>
      <TextInput
        accessibilityLabel={label}
        keyboardAppearance={theme.mode}
        maxFontSizeMultiplier={theme.maxFontScale}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={[
          typography.body,
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radii.control,
            borderWidth: sizes.border,
            color: colors.textPrimary,
            minHeight: sizes.control,
            paddingHorizontal: spacing.l,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <AppText accessibilityLiveRegion="polite" variant="caption" tone="danger">
          {error}
        </AppText>
      ) : null}
      {hint && !error ? (
        <AppText variant="caption" tone="secondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
