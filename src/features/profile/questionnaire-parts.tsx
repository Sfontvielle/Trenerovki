import { SymbolView } from 'expo-symbols';
import { type ComponentProps, useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { AppText, useTheme } from '@/design-system';
import { allowedDaysPerWeek, type DaysPerWeek, type Sex } from '@/domains/profile/profile';
import { sexLabels } from '@/features/profile/labels';
import { pluralize } from '@/lib/format';

export type SymbolName = ComponentProps<typeof SymbolView>['name'];

type QuestionHeaderProps = {
  current: number;
  total: number;
  onBack: () => void;
};

export function QuestionHeader({ current, total, onBack }: QuestionHeaderProps) {
  const { theme } = useTheme();
  const { colors, motion, radii, sizes, spacing } = theme;
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: current / total,
      duration: motion.normal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [current, motion.normal, progress, total]);

  return (
    <View style={[styles.header, { gap: spacing.s }]}>
      <Pressable
        accessibilityLabel="Назад"
        accessibilityRole="button"
        hitSlop={spacing.s}
        onPress={onBack}
        style={({ pressed }) => [
          styles.back,
          {
            backgroundColor: colors.surface,
            borderRadius: radii.full,
            height: sizes.minTouch,
            opacity: pressed ? 0.6 : 1,
            width: sizes.minTouch,
          },
        ]}
      >
        <AppText variant="heading">‹</AppText>
      </Pressable>
      <View style={[styles.headerCenter, { gap: spacing.s }]}>
        <AppText accessibilityLabel={`Вопрос ${current} из ${total}`} variant="callout">
          {`${current} из ${total}`}
        </AppText>
        <View
          style={[
            styles.track,
            { backgroundColor: colors.surfaceRaised, borderRadius: radii.full, height: sizes.progressBar },
          ]}
        >
          <Animated.View
            style={{
              backgroundColor: colors.accent,
              borderRadius: radii.full,
              height: sizes.progressBar,
              width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            }}
          />
        </View>
      </View>
      <View style={{ width: sizes.minTouch }} />
    </View>
  );
}

type QuestionTitleProps = {
  title: string;
  hint?: string;
};

export function QuestionTitle({ title, hint }: QuestionTitleProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.centered, { gap: theme.spacing.s }]}>
      <AppText accessibilityRole="header" variant="title" style={styles.centeredText}>
        {title}
      </AppText>
      {hint ? (
        <AppText tone="secondary" style={styles.centeredText}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

function selectedSurface(theme: ReturnType<typeof useTheme>['theme'], selected: boolean) {
  const { colors, shadows, sizes } = theme;

  return {
    backgroundColor: selected ? colors.accentSoft : colors.surface,
    borderColor: selected ? colors.accent : colors.border,
    borderWidth: sizes.border * 1.5,
    boxShadow: selected ? shadows.selected : undefined,
  };
}

type ChoiceCardProps = {
  title: string;
  hint?: string;
  symbol?: SymbolName;
  selected: boolean;
  multiple?: boolean;
  onPress: () => void;
};

export function ChoiceCard({ title, hint, symbol, selected, multiple = false, onPress }: ChoiceCardProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;

  return (
    <Pressable
      accessibilityHint={hint}
      accessibilityLabel={title}
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selectedSurface(theme, selected),
        {
          borderRadius: radii.panel,
          gap: spacing.m,
          minHeight: hint ? sizes.choiceTallHeight : sizes.choiceMinHeight,
          opacity: pressed ? 0.8 : 1,
          paddingHorizontal: spacing.l,
          paddingVertical: spacing.m,
        },
      ]}
    >
      {symbol ? (
        <SymbolView name={symbol} size={sizes.minTouch / 2} tintColor={selected ? colors.accent : colors.textPrimary} />
      ) : null}
      <View style={[styles.cardText, { gap: spacing.xs }]}>
        <AppText variant="heading">{title}</AppText>
        {hint ? (
          <AppText variant="callout" tone="secondary">
            {hint}
          </AppText>
        ) : null}
      </View>
      {selected ? (
        <AppText variant="heading" tone="accent">
          ✓
        </AppText>
      ) : null}
    </Pressable>
  );
}

type SexCardsProps = {
  value: Sex | null;
  onChange: (value: Sex | null) => void;
};

export function SexCards({ value, onChange }: SexCardsProps) {
  const { theme } = useTheme();
  const { colors, radii, spacing } = theme;
  const options: { sex: Sex; symbol: SymbolName }[] = [
    { sex: 'male', symbol: 'figure.stand' },
    { sex: 'female', symbol: 'figure.stand.dress' },
  ];

  return (
    <View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.m }]}>
      {options.map(({ sex, symbol }) => {
        const selected = value === sex;
        return (
          <Pressable
            key={sex}
            accessibilityLabel={sexLabels[sex]}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(selected ? null : sex)}
            style={({ pressed }) => [
              styles.sexCard,
              selectedSurface(theme, selected),
              { borderRadius: radii.panel, gap: spacing.m, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <SymbolView name={symbol} size={48} tintColor={selected ? colors.accent : colors.textPrimary} />
            <AppText variant="heading">{sexLabels[sex]}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

type FrequencyPickerProps = {
  value: DaysPerWeek | null;
  onChange: (value: DaysPerWeek) => void;
};

function timesWord(count: number) {
  return pluralize(count, ['раз', 'раза', 'раз']);
}

export function FrequencyPicker({ value, onChange }: FrequencyPickerProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;

  return (
    <View style={[styles.centered, { gap: spacing.l }]}>
      <AppText variant="display" tone={value ? 'primary' : 'secondary'}>
        {value ?? '—'}
      </AppText>
      <AppText tone="secondary">
        {value ? `${timesWord(value)} в неделю` : 'Выберите число'}
      </AppText>
      <View accessibilityRole="radiogroup" style={[styles.row, { gap: spacing.m }]}>
        {allowedDaysPerWeek.map((days) => {
          const selected = value === days;
          return (
            <Pressable
              key={days}
              accessibilityLabel={`${days} ${timesWord(days)} в неделю`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(days)}
              style={({ pressed }) => [
                styles.dayChip,
                selectedSurface(theme, selected),
                {
                  borderRadius: radii.control,
                  height: sizes.control,
                  opacity: pressed ? 0.8 : 1,
                  width: sizes.control,
                },
              ]}
            >
              <AppText variant="heading" tone={selected ? 'accent' : 'primary'} style={{ color: selected ? colors.accent : undefined }}>
                {days}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  cardText: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
  },
  centeredText: {
    textAlign: 'center',
  },
  dayChip: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  sexCard: {
    alignItems: 'center',
    aspectRatio: 0.82,
    flex: 1,
    justifyContent: 'center',
  },
  track: {
    overflow: 'hidden',
    width: '100%',
  },
});
