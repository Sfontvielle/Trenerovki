import { StyleSheet, View } from 'react-native';

import { AppText, useTheme } from '@/design-system';
import { dayKey } from '@/domains/nutrition/nutrition';
import { weekdays } from '@/domains/program/schedule';
import { formatMonth } from '@/lib/format';
import { t } from '@/lib/i18n';

const DAYS_IN_WEEK = 7;

function weeksOfMonth(now: Date) {
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const dayCount = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const blanks = (first.getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK;
  const cells: (Date | null)[] = [
    ...Array.from({ length: blanks }, () => null),
    ...Array.from({ length: dayCount }, (_, index) => new Date(now.getFullYear(), now.getMonth(), index + 1)),
  ];
  while (cells.length % DAYS_IN_WEEK > 0) {
    cells.push(null);
  }
  return Array.from({ length: cells.length / DAYS_IN_WEEK }, (_, week) =>
    cells.slice(week * DAYS_IN_WEEK, (week + 1) * DAYS_IN_WEEK),
  );
}

type MonthCalendarProps = {
  trainedDays: string[];
  now: Date;
};

export function MonthCalendar({ trainedDays, now }: MonthCalendarProps) {
  const { theme } = useTheme();
  const { colors, radii, sizes, spacing } = theme;
  const today = dayKey(now);
  const month = formatMonth(now);
  const inMonth = trainedDays.filter((day) => day.startsWith(today.slice(0, 7))).length;

  return (
    <View style={{ gap: spacing.s }}>
      <AppText accessibilityRole="header" variant="heading">
        {month}
      </AppText>
      <View accessibilityLabel={t('Дней с тренировками: {0}', { 0: inMonth })} accessible style={{ gap: spacing.xs }}>
        <View style={styles.row}>
          {weekdays.map(({ value, short }) => (
            <AppText key={value} variant="caption" tone="secondary" style={styles.cell}>
              {short}
            </AppText>
          ))}
        </View>
        {weeksOfMonth(now).map((week, index) => (
          <View key={index} style={styles.row}>
            {week.map((date, position) => {
              const key = date ? dayKey(date) : '';
              const trained = trainedDays.includes(key);
              return (
                <View key={position} style={[styles.cell, styles.center]}>
                  {date ? (
                    <View
                      style={[
                        styles.center,
                        {
                          backgroundColor: trained ? colors.accent : 'transparent',
                          borderColor: key === today ? colors.accent : 'transparent',
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
                  ) : null}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cell: {
    flex: 1,
    textAlign: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
  },
});
