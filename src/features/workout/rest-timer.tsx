import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Panel, useTheme } from '@/design-system';
import { formatDuration } from '@/domains/workout/session-time';
import { successFeedback } from '@/lib/haptics';
import { playRestFinished } from '@/lib/sounds';
import { t } from '@/lib/i18n';

const TICK_MS = 500;
const durations = [45, 60, 75, 90, 120, 180];

function deadlineAfter(seconds: number) {
  return Date.now() + seconds * 1000;
}

type RestTimerProps = {
  recommendedSeconds: number;
};

export function RestTimer({ recommendedSeconds }: RestTimerProps) {
  const { theme } = useTheme();
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (endsAt === null) {
      return;
    }
    const tick = () => {
      const left = endsAt - Date.now();
      setRemainingMs(Math.max(0, left));
      if (left <= 0) {
        setEndsAt(null);
        setFinished(true);
        successFeedback();
        playRestFinished();
      }
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [endsAt]);

  const start = (seconds: number) => {
    setFinished(false);
    setRemainingMs(seconds * 1000);
    setEndsAt(deadlineAfter(seconds));
  };

  return (
    <Panel>
      <AppText variant="heading">{t('Отдых')}</AppText>
      {endsAt !== null ? (
        <>
          <AppText accessibilityLiveRegion="polite" variant="display" tone="accent">
            {formatDuration(Math.ceil(remainingMs / 1000) * 1000)}
          </AppText>
          <Button
            label={t('Остановить таймер')}
            variant="secondary"
            onPress={() => {
              setEndsAt(null);
              setRemainingMs(0);
            }}
          />
        </>
      ) : (
        <>
          {finished ? (
            <AppText accessibilityLiveRegion="polite" tone="accent">
              {t('Отдых окончен')}
            </AppText>
          ) : (
            <AppText variant="callout" tone="secondary">
              {t('Необязательно. Для этого упражнения обычно хватает {0}. Таймер работает, пока открыт этот экран.', { 0: formatDuration(recommendedSeconds * 1000) })}
            </AppText>
          )}
          <View style={[styles.row, { gap: theme.spacing.s }]}>
            {durations.map((seconds) => (
              <Chip
                key={seconds}
                label={formatDuration(seconds * 1000)}
                selected={seconds === recommendedSeconds}
                onPress={() => start(seconds)}
              />
            ))}
          </View>
        </>
      )}
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
