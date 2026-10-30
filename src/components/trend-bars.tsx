import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, useTheme } from '@/design-system';

export type TrendBar = {
  key: string;
  value: number;
  label: string;
};

type TrendBarsProps = {
  bars: TrendBar[];
};

export function TrendBars({ bars }: TrendBarsProps) {
  const { theme } = useTheme();
  const { colors, sizes, spacing } = theme;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = bars.find((bar) => bar.key === selectedKey) ?? bars.at(-1);
  const highest = Math.max(...bars.map((bar) => bar.value));

  return (
    <View style={{ gap: spacing.s }}>
      <AppText accessibilityLiveRegion="polite" variant="callout" tone="secondary">
        {selected?.label}
      </AppText>
      <View style={[styles.plot, { gap: spacing.xs, height: sizes.chartHeight }]}>
        {bars.map((bar) => {
          const active = bar.key === selected?.key;
          return (
            <Pressable
              key={bar.key}
              accessibilityLabel={bar.label}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedKey(bar.key)}
              style={[styles.column, { maxWidth: sizes.chartBar }]}
            >
              <View
                style={{
                  backgroundColor: active ? colors.accent : colors.border,
                  borderTopLeftRadius: spacing.xs,
                  borderTopRightRadius: spacing.xs,
                  height: `${(bar.value / highest) * 100}%`,
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  plot: {
    alignItems: 'flex-end',
    flexDirection: 'row',
  },
});
