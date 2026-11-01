import { StyleSheet, View } from 'react-native';

import { AppText, useTheme } from '@/design-system';
import { dayKey } from '@/domains/nutrition/nutrition';
import { weekdays } from '@/domains/program/schedule';
import { t } from '@/lib/i18n';

const DAYS_FROM_SUNDAY_TO_MONDAY = 6;

function daysOfWeek(now: Date) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (now.getDay() + DAYS_FROM_SUNDAY_TO_MONDAY) % 7);
  return weekdays.map(({ value, short }, index) => ({
    value,
    short,
    date: new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index),
  }));
}

type WeekStripProps = {
  trainedDays: string[];
  plannedWeekdays: number[];
  now: Date;
};

export function WeekStrip({ trainedDays, plannedWeekdays, now }: WeekStripProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;
  const today = dayKey(now);
  const days = daysOfWeek(now).map((day) => ({
    ...day,
    key: dayKey(day.date),
    trained: trainedDays.includes(dayKey(day.date)),
    planned: plannedWeekdays.includes(day.value),
  }));
  const trainedCount = days.filter(({ trained }) => trained).length;

  return (
    <View accessibilityLabel={t('Тренировок на этой неделе: {0}', { 0: trainedCount })} accessible style={styles.row}>
      {days.map(({ key, short, date, trained, planned }) => (
        <View key={key} style={[styles.day, { gap: spacing.xs }]}>
          <AppText variant="caption" tone={key === today ? 'accent' : 'secondary'}>
            {short}
          </AppText>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: trained ? colors.accent : 'transparent',
                borderColor: planned || key === today ? colors.accent : 'transparent',
                borderRadius: radii.full,
                borderWidth: sizes.border,
                height: sizes.weekDot,
                width: sizes.weekDot,
              },
            ]}
          >
            <AppText variant="scoreSmall" style={trained ? { color: colors.onAccent } : undefined} tone={trained ? undefined : 'secondary'}>
              {date.getDate()}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  day: {
    alignItems: 'center',
    flex: 1,
  },
  dot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
});
