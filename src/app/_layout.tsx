import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DesignSystemProvider, useTheme } from '@/design-system';

function RootStack() {
  const { theme } = useTheme();
  const { colors } = theme;
  const baseTheme = theme.mode === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      background: colors.background,
      border: colors.border,
      card: colors.surface,
      primary: colors.accent,
      text: colors.textPrimary,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="design-system" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <DesignSystemProvider>
      <RootStack />
    </DesignSystemProvider>
  );
}
