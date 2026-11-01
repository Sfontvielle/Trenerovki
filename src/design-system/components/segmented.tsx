import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../theme-provider';
import { AppText } from './app-text';

type SegmentedProps<Value extends string> = {
  label: string;
  options: { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
};

export function Segmented<Value extends string>({ label, options, value, onChange }: SegmentedProps<Value>) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="tablist"
      style={[styles.row, { backgroundColor: colors.surface, borderRadius: radii.control, padding: spacing.xs }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              {
                backgroundColor: selected ? colors.surfaceRaised : 'transparent',
                borderRadius: radii.chip,
                minHeight: sizes.segment,
              },
            ]}
          >
            <AppText variant="callout" tone={selected ? 'primary' : 'secondary'} numberOfLines={1}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  segment: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
});
