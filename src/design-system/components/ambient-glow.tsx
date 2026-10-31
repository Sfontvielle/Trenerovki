import { StyleSheet, View } from 'react-native';

import { useTheme } from '../theme-provider';

export function AmbientGlow() {
  const { theme } = useTheme();

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.layer}
    >
      <View style={[styles.primary, { boxShadow: theme.shadows.ambient }]} />
      <View style={[styles.secondary, { boxShadow: theme.shadows.ambientSecond }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  primary: {
    height: 1,
    left: '12%',
    position: 'absolute',
    top: '6%',
    width: 1,
  },
  secondary: {
    height: 1,
    position: 'absolute',
    right: '4%',
    top: '22%',
    width: 1,
  },
});
