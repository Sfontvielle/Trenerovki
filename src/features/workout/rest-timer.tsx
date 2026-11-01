import { StyleSheet, View } from 'react-native';

import { AppText, Chip, Panel, useTheme } from '@/design-system';
import { formatDuration } from '@/domains/workout/session-time';
import { restTimer } from '@/features/workout/rest-store';
import { t } from '@/lib/i18n';

const durations = [45, 60, 75, 90, 120, 180];

type RestTimerProps = {
  recommendedSeconds: number;
};

export function RestTimer({ recommendedSeconds }: RestTimerProps) {
  const { theme } = useTheme();

  return (
    <Panel>
      <AppText variant="heading">{t('Отдых')}</AppText>
      <AppText variant="callout" tone="secondary">
        {t('Необязательно. Для этого упражнения обычно хватает {0}.', { 0: formatDuration(recommendedSeconds * 1000) })}
      </AppText>
      <View style={[styles.row, { gap: theme.spacing.s }]}>
        {durations.map((seconds) => (
          <Chip
            key={seconds}
            label={formatDuration(seconds * 1000)}
            selected={seconds === recommendedSeconds}
            onPress={() => restTimer.start(seconds)}
          />
        ))}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
