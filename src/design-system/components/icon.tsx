import { SymbolView } from 'expo-symbols';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme-provider';

export type IconName = ComponentProps<typeof SymbolView>['name'];

type IconProps = {
  name: IconName;
  // Shown where SF Symbols do not exist, such as the browser preview.
  glyph: string;
  size?: number;
  color?: string;
};

export function Icon({ name, glyph, size, color }: IconProps) {
  const { theme } = useTheme();
  const tint = color ?? theme.colors.textSecondary;
  const side = size ?? theme.sizes.icon;

  return (
    <SymbolView
      fallback={<Text style={{ color: tint, fontSize: side * theme.sizes.glyphScale, lineHeight: side }}>{glyph}</Text>}
      name={name}
      size={side}
      tintColor={tint}
    />
  );
}

type IconButtonProps = IconProps & {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function IconButton({ label, onPress, disabled = false, ...icon }: IconButtonProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes } = theme;

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={theme.spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radii.full,
          height: sizes.minTouch,
          opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
          width: sizes.minTouch,
        },
      ]}
    >
      <View pointerEvents="none">
        <Icon {...icon} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
