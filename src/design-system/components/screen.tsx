import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme-provider';

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
}>;

export function Screen({ scroll = false, children }: ScreenProps) {
  const { theme } = useTheme();
  const content = { padding: theme.spacing.l, gap: theme.spacing.xl };

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: theme.colors.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, content]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
