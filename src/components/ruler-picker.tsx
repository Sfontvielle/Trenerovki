import { useEffect, useRef, useState } from 'react';
import { type LayoutChangeEvent, PanResponder, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, useTheme } from '@/design-system';
import { formatInputNumber, parseDecimal } from '@/lib/format';

const PIXELS_PER_UNIT = 9;
const HIGHLIGHT_RANGE = 6;
const DEFAULT_WIDTH = 320;

type RulerPickerProps = {
  label: string;
  unit: string;
  value: number | null;
  start: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
};

export function RulerPicker({ label, unit, value, start, min, max, step, onChange }: RulerPickerProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing, typography } = theme;
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [text, setText] = useState<string | null>(null);
  const shown = value ?? start;
  const picked = value !== null;

  const snap = (raw: number) => {
    const rounded = Math.round(raw / step) * step;
    return Number(Math.min(max, Math.max(min, rounded)).toFixed(1));
  };

  const latest = useRef({ value, start, onChange, snap });
  useEffect(() => {
    latest.current = { value, start, onChange, snap };
  });

  // The ref is read only inside gesture handlers, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const drag = { from: 0, last: 0 };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        drag.from = latest.current.value ?? latest.current.start;
        drag.last = drag.from;
      },
      onPanResponderMove: (_, gesture) => {
        const next = latest.current.snap(drag.from - gesture.dx / PIXELS_PER_UNIT);
        if (next !== drag.last) {
          drag.last = next;
          latest.current.onChange(next);
        }
      },
    });
  });

  const halfVisible = Math.ceil(width / 2 / PIXELS_PER_UNIT) + 1;
  const ticks: number[] = [];
  for (let unitValue = Math.floor(shown) - halfVisible; unitValue <= Math.ceil(shown) + halfVisible; unitValue += 1) {
    if (unitValue >= min && unitValue <= max) {
      ticks.push(unitValue);
    }
  }

  const bump = (delta: number) => onChange(snap(shown + delta));

  return (
    <View style={{ alignItems: 'center', gap: spacing.xl }}>
      <View
        style={[
          styles.valueBox,
          {
            backgroundColor: colors.surface,
            borderColor: picked ? colors.accent : colors.border,
            borderRadius: radii.panel,
            borderWidth: sizes.border,
            gap: spacing.s,
            minHeight: sizes.choiceMinHeight,
            paddingHorizontal: spacing.xl,
          },
        ]}
      >
        <TextInput
          accessibilityLabel={`${label}, ${unit}`}
          keyboardAppearance={theme.mode}
          keyboardType="decimal-pad"
          maxFontSizeMultiplier={theme.maxFontScale}
          maxLength={5}
          onBlur={() => setText(null)}
          onChangeText={(input) => {
            setText(input);
            const parsed = parseDecimal(input);
            if (parsed !== null && Number.isFinite(parsed)) {
              onChange(parsed);
            }
          }}
          onFocus={() => setText(formatInputNumber(value))}
          placeholder="—"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accent}
          style={[typography.display, styles.valueInput, { color: colors.textPrimary }]}
          value={text ?? formatInputNumber(value)}
        />
        <AppText variant="heading" tone="secondary">
          {unit}
        </AppText>
      </View>

      <View
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        accessibilityLabel={label}
        accessibilityRole="adjustable"
        accessibilityValue={{ text: picked ? `${formatInputNumber(value)} ${unit}` : 'не выбрано' }}
        accessible
        onAccessibilityAction={(event) => bump(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        style={[styles.ruler, { height: sizes.rulerHeight }]}
        {...pan.panHandlers}
      >
        {ticks.map((tick) => {
          const x = width / 2 + (tick - shown) * PIXELS_PER_UNIT;
          const major = tick % 10 === 0;
          const middle = tick % 5 === 0;
          const distance = Math.abs(tick - shown);
          const near = picked && distance < HIGHLIGHT_RANGE;

          return (
            <View key={tick} pointerEvents="none" style={[styles.tick, { left: x - 1 }]}>
              <View
                style={{
                  backgroundColor: near ? colors.accent : colors.border,
                  height: major ? 40 : middle ? 30 : 20,
                  opacity: near ? 1 - distance / (HIGHLIGHT_RANGE * 1.6) : 1,
                  width: major ? 2 : 1.5,
                }}
              />
              {major && x > spacing.xl && x < width - spacing.xl ? (
                <AppText variant="caption" tone={distance < 5 && picked ? 'primary' : 'secondary'} style={styles.tickLabel}>
                  {tick}
                </AppText>
              ) : null}
            </View>
          );
        })}
        <View
          pointerEvents="none"
          style={[
            styles.needle,
            { backgroundColor: picked ? colors.accent : colors.textSecondary, left: width / 2 - 1.5 },
          ]}
        />
      </View>

      <View style={styles.adjustRow}>
        {[
          { delta: -step, symbol: '−', name: 'меньше' },
          { delta: step, symbol: '+', name: 'больше' },
        ].map(({ delta, symbol, name }) => (
          <Pressable
            key={symbol}
            accessibilityLabel={`${label}: ${name}`}
            accessibilityRole="button"
            onPress={() => bump(delta)}
            style={({ pressed }) => [
              styles.adjust,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderRadius: radii.full,
                borderWidth: sizes.border,
                height: sizes.control,
                opacity: pressed ? 0.6 : 1,
                width: sizes.control,
              },
            ]}
          >
            <AppText variant="title">{symbol}</AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  adjust: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  needle: {
    borderRadius: 2,
    height: 50,
    position: 'absolute',
    top: -4,
    width: 3,
  },
  ruler: {
    overflow: 'hidden',
    width: '100%',
  },
  tick: {
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    width: 2,
  },
  tickLabel: {
    position: 'absolute',
    textAlign: 'center',
    top: 50,
    width: 44,
  },
  valueBox: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 190,
  },
  valueInput: {
    textAlign: 'center',
    width: 112,
  },
});
