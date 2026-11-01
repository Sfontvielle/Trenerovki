import { StyleSheet, View } from 'react-native';

import { AppText } from '@/design-system';

type StatProps = {
  value: string;
  label: string;
  size?: 'medium' | 'large';
};

export function Stat({ value, label, size = 'medium' }: StatProps) {
  return (
    <View accessibilityLabel={`${label}: ${value}`} accessible style={styles.stat}>
      <AppText variant={size === 'large' ? 'scoreLarge' : 'scoreMedium'} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </AppText>
      <AppText variant="caption" tone="secondary" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: {
    flex: 1,
  },
});
