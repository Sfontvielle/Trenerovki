import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Chip, Panel, useTheme } from '@/design-system';
import { formatDuration } from '@/domains/workout/session-time';
import { successFeedback } from '@/lib/haptics';

const TICK_MS = 500;
const durations = [
  { seconds: 60, label: '1:00' },
  { seconds: 90, label: '1:30' },
  { seconds: 120, label: '2:00' },
  { seconds: 180, label: '3:00' },
];

function deadlineAfter(seconds: number) {
  return Date.now() + seconds * 1000;
}

export function RestTimer() {
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
      <AppText variant="heading">Отдых</AppText>
      {endsAt !== null ? (
        <>
          <AppText accessibilityLiveRegion="polite" variant="display" tone="accent">
            {formatDuration(Math.ceil(remainingMs / 1000) * 1000)}
          </AppText>
          <Button
            label="Остановить таймер"
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
              Отдых окончен
            </AppText>
          ) : (
            <AppText variant="callout" tone="secondary">
              Необязательно. Таймер работает, пока открыт этот экран.
            </AppText>
          )}
          <View style={[styles.row, { gap: theme.spacing.s }]}>
            {durations.map(({ seconds, label }) => (
              <Chip key={seconds} label={label} selected={false} onPress={() => start(seconds)} />
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
