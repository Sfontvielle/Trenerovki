import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppDataProvider, useAppData } from '@/app-data/app-data';
import { ErrorState } from '@/components/states';
import { DesignSystemProvider, Screen, useTheme } from '@/design-system';

function RootStack() {
  const { profile } = useAppData();
  const { theme } = useTheme();
  const { colors } = theme;
  const hasProfile = profile !== null;
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
        <Stack.Protected guard={!hasProfile}>
          <Stack.Screen name="welcome" />
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={hasProfile}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="edit-profile" />
          <Stack.Screen name="workout/index" options={{ ...withHeader, title: 'Тренировка' }} />
          <Stack.Screen name="workout/[sessionExerciseId]" options={{ ...withHeader, title: 'Упражнение' }} />
          <Stack.Screen
            name="workout/add"
            options={{ ...withHeader, presentation: 'modal', title: 'Добавить упражнение' }}
          />
          <Stack.Screen name="history/[sessionId]" options={{ ...withHeader, title: 'Тренировка' }} />
          <Stack.Screen name="history/set/[setId]" options={{ ...withHeader, title: 'Исправить подход' }} />
          <Stack.Screen name="exercise-progress/[exerciseId]" options={{ ...withHeader, title: 'Динамика' }} />
          <Stack.Screen
            name="food/add"
            options={{ ...withHeader, presentation: 'modal', title: 'Добавить продукт' }}
          />
          <Stack.Screen name="food/[entryId]" options={{ ...withHeader, title: 'Запись' }} />
          <Stack.Screen
            name="food/scan"
            options={{ ...withHeader, presentation: 'modal', title: 'Штрихкод' }}
          />
          <Stack.Screen
            name="food/recipe"
            options={{ ...withHeader, presentation: 'modal', title: 'Блюдо из продуктов' }}
          />
          <Stack.Screen name="nutrition-targets" options={{ ...withHeader, title: 'Цели по питанию' }} />
          <Stack.Screen name="body-weight" options={{ ...withHeader, title: 'Вес тела' }} />
          <Stack.Screen name="exercises/index" options={{ ...withHeader, title: 'Упражнения' }} />
          <Stack.Screen name="exercises/[exerciseId]" options={{ ...withHeader, title: 'Упражнение' }} />
          <Stack.Screen
            name="exercises/new"
            options={{ ...withHeader, presentation: 'modal', title: 'Новое упражнение' }}
          />
          <Stack.Screen name="plan/[dayId]" options={{ ...withHeader, title: 'Изменить упражнения' }} />
          <Stack.Screen
            name="plan/pick"
            options={{ ...withHeader, presentation: 'modal', title: 'Выбрать упражнение' }}
          />
          <Stack.Screen
            name="check-in"
            options={{ ...withHeader, presentation: 'modal', title: 'Сон и самочувствие' }}
          />
          <Stack.Screen name="coach/history" options={{ ...withHeader, title: 'История решений' }} />
          <Stack.Screen name="coach/memory" options={{ ...withHeader, title: 'Память и предпочтения' }} />
          <Stack.Screen name="analytics" options={{ ...withHeader, title: 'Аналитика' }} />
          <Stack.Screen name="about" options={{ ...withHeader, title: 'О приложении' }} />
          <Stack.Screen name="design-system" options={{ ...withHeader, title: 'Дизайн-система' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  console.error(error);

  return (
    <DesignSystemProvider>
      <Screen>
        <ErrorState message="Экран не открылся. Ваши записи не затронуты." onRetry={retry} />
      </Screen>
    </DesignSystemProvider>
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
