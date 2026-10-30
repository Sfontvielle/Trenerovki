import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppDataProvider } from '@/app-data/app-data';
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
  const withHeader = {
    headerBackTitle: 'Назад',
    headerShadowVisible: false,
    headerShown: true,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.accent,
    headerTitleStyle: { color: colors.textPrimary },
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
        <Stack.Screen name="welcome" />
        <Stack.Screen name="onboarding" options={{ ...withHeader, title: 'Анкета' }} />
        <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="workout/index" options={{ ...withHeader, title: 'Тренировка' }} />
        <Stack.Screen name="workout/[sessionExerciseId]" options={{ ...withHeader, title: 'Упражнение' }} />
        <Stack.Screen
          name="workout/add"
          options={{ ...withHeader, presentation: 'modal', title: 'Добавить упражнение' }}
        />
        <Stack.Screen name="history/[sessionId]" options={{ ...withHeader, title: 'Тренировка' }} />
        <Stack.Screen name="exercise-progress/[exerciseId]" options={{ ...withHeader, title: 'Динамика' }} />
        <Stack.Screen name="design-system" options={{ ...withHeader, title: 'Дизайн-система' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <DesignSystemProvider>
      <AppDataProvider>
        <RootStack />
      </AppDataProvider>
    </DesignSystemProvider>
  );
}
