import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText, useTheme } from '@/design-system';

const STROKE = 7;
const OPEN_ARC = 0.75;
const START_ANGLE = 135;

type GaugeProps = {
  // Share of the target from 0 to 1, or null when there is no target to measure against.
  ratio: number | null;
  value: string;
  unit?: string;
  label: string;
  color?: string;
  onPress?: () => void;
};

// An open arc, so it never reads as Apple's closed Activity rings.
export function Gauge({ ratio, value, unit, label, color, onPress }: GaugeProps) {
  const { theme } = useTheme();
  const { colors, sizes, spacing } = theme;
  const side = sizes.gauge;
  const radius = (side - STROKE) / 2;
  const length = 2 * Math.PI * radius;
  const track = length * OPEN_ARC;
  const filled = track * Math.min(1, Math.max(0, ratio ?? 0));

  const description = `${label}: ${value}${unit ? ` ${unit}` : ''}`;
  const figure = (
    <>
      <View style={{ height: side, width: side }}>
        <Svg height={side} width={side}>
          <Circle
            cx={side / 2}
            cy={side / 2}
            fill="none"
            r={radius}
            rotation={START_ANGLE}
            origin={`${side / 2}, ${side / 2}`}
            stroke={colors.border}
            strokeDasharray={`${track} ${length}`}
            strokeLinecap="round"
            strokeWidth={STROKE}
          />
          {filled > 0 ? (
            <Circle
              cx={side / 2}
              cy={side / 2}
              fill="none"
              r={radius}
              rotation={START_ANGLE}
              origin={`${side / 2}, ${side / 2}`}
              stroke={color ?? colors.accent}
              strokeDasharray={`${filled} ${length}`}
              strokeLinecap="round"
              strokeWidth={STROKE}
            />
          ) : null}
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <AppText variant="scoreMedium" numberOfLines={1} adjustsFontSizeToFit>
            {value}
          </AppText>
          {unit ? (
            <AppText variant="caption" tone="secondary">
              {unit}
            </AppText>
          ) : null}
        </View>
      </View>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </>
  );

  if (onPress) {
    return (
      <Pressable accessibilityLabel={description} accessibilityRole="button" onPress={onPress} style={[styles.column, { gap: spacing.xs }]}>
        {figure}
      </Pressable>
    );
  }
  return (
    <View accessibilityLabel={description} accessible style={[styles.column, { gap: spacing.xs }]}>
      {figure}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  column: {
    alignItems: 'center',
    flex: 1,
  },
});
