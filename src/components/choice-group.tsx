import { StyleSheet, View } from 'react-native';

import { AppText, Chip, useTheme } from '@/design-system';

type Choice<Value> = {
  value: Value;
  label: string;
};

type ChoiceGroupProps<Value> = {
  label: string;
  choices: Choice<Value>[];
  isSelected: (value: Value) => boolean;
  onSelect: (value: Value) => void;
};

export function ChoiceGroup<Value extends string | number | null>({
  label,
  choices,
  isSelected,
  onSelect,
}: ChoiceGroupProps<Value>) {
  const { theme } = useTheme();

  return (
    <View style={{ gap: theme.spacing.s }}>
      <AppText variant="callout" tone="secondary">
        {label}
      </AppText>
      <View
        accessibilityLabel={label}
        accessibilityRole="radiogroup"
        style={[styles.row, { gap: theme.spacing.s }]}
      >
        {choices.map((choice) => (
          <Chip
            key={String(choice.value)}
            label={choice.label}
            selected={isSelected(choice.value)}
            onPress={() => onSelect(choice.value)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
