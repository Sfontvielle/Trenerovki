import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DesignSystemProvider, useTheme } from '@/design-system';

function RootStack() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false,
        }}
      />
    </>
  );
}

export default function RootLayout() {
  return (
    <DesignSystemProvider>
      <RootStack />
    </DesignSystemProvider>
  );
}
