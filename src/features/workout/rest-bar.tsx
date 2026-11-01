import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ProgressLine } from '@/components/progress-line';
import { AppText, useTheme } from '@/design-system';
import { formatDuration } from '@/domains/workout/session-time';
import { restTimer, useRestTimer } from '@/features/workout/rest-store';
import { t } from '@/lib/i18n';

const TICK_MS = 250;
const STEP_SECONDS = 15;

type RestActionProps = {
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
};

function RestAction({ label, accessibilityLabel, onPress }: RestActionProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={theme.spacing.xs}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: theme.colors.surfaceRaised,
          borderRadius: theme.radii.chip,
          minHeight: theme.sizes.minTouch,
          opacity: pressed ? 0.6 : 1,
          paddingHorizontal: theme.spacing.m,
        },
      ]}
    >
      <AppText variant="callout">{label}</AppText>
    </Pressable>
  );
}

export function RestBar() {
  const { theme } = useTheme();
  const { colors, radii, spacing } = theme;
  const { endsAt, totalMs } = useRestTimer();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (endsAt === null) {
      return;
    }
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [endsAt]);

  if (endsAt === null) {
    return null;
  }

  const remainingMs = Math.min(Math.max(0, endsAt - now), totalMs);

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.panel,
        boxShadow: theme.shadows.selected,
        gap: spacing.s,
        padding: spacing.m,
      }}
    >
      <View style={[styles.row, { gap: spacing.s }]}>
        <View style={styles.time}>
          <AppText variant="caption" tone="secondary">
            {t('Отдых')}
          </AppText>
          <AppText accessibilityLiveRegion="polite" variant="scoreLarge" tone="accent">
            {formatDuration(Math.ceil(remainingMs / 1000) * 1000)}
          </AppText>
        </View>
        <RestAction
          accessibilityLabel={t('Убавить 15 секунд')}
          label={`−${STEP_SECONDS}`}
          onPress={() => restTimer.adjust(-STEP_SECONDS)}
        />
        <RestAction
          accessibilityLabel={t('Прибавить 15 секунд')}
          label={`+${STEP_SECONDS}`}
          onPress={() => restTimer.adjust(STEP_SECONDS)}
        />
        <RestAction accessibilityLabel={t('Пропустить отдых')} label={t('Хватит')} onPress={restTimer.stop} />
      </View>
      <ProgressLine label={t('Осталось отдыха')} ratio={totalMs > 0 ? remainingMs / totalMs : 0} />
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  time: {
    flex: 1,
  },
});
