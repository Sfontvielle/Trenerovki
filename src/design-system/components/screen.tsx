import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme-provider';

const allEdges: Edge[] = ['top', 'right', 'bottom', 'left'];
const belowHeaderEdges: Edge[] = ['right', 'bottom', 'left'];

type ScreenProps = PropsWithChildren<{
  scroll?: boolean;
  belowHeader?: boolean;
}>;

export function Screen({ scroll = false, belowHeader = false, children }: ScreenProps) {
  const { theme } = useTheme();
  const content = { padding: theme.spacing.l, gap: theme.spacing.xl };

  return (
    <SafeAreaView
      edges={belowHeader ? belowHeaderEdges : allEdges}
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
    >
      {scroll ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={content}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
        >
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
