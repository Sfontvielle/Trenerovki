import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AppDataProvider, useAppData } from '@/app-data/app-data';
import { ErrorState } from '@/components/states';
import { DesignSystemProvider, Screen, useTheme } from '@/design-system';
import { t } from '@/lib/i18n';

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
    headerBackTitle: t('Назад'),
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
          <Stack.Screen name="workout/index" options={{ ...withHeader, title: t('Тренировка') }} />
          <Stack.Screen name="workout/[sessionExerciseId]" options={{ ...withHeader, title: t('Упражнение') }} />
          <Stack.Screen
            name="workout/add"
            options={{ ...withHeader, presentation: 'modal', title: t('Добавить упражнение') }}
          />
          <Stack.Screen name="history/[sessionId]" options={{ ...withHeader, title: t('Тренировка') }} />
          <Stack.Screen name="history/set/[setId]" options={{ ...withHeader, title: t('Исправить подход') }} />
          <Stack.Screen name="exercise-progress/[exerciseId]" options={{ ...withHeader, title: t('Динамика') }} />
          <Stack.Screen
            name="food/add"
            options={{ ...withHeader, presentation: 'modal', title: t('Добавить продукт') }}
          />
          <Stack.Screen name="food/[entryId]" options={{ ...withHeader, title: t('Запись') }} />
          <Stack.Screen
            name="food/scan"
            options={{ ...withHeader, presentation: 'modal', title: t('Штрихкод') }}
          />
          <Stack.Screen
            name="food/recipe"
            options={{ ...withHeader, presentation: 'modal', title: t('Блюдо из продуктов') }}
          />
          <Stack.Screen name="nutrition-targets" options={{ ...withHeader, title: t('Цели по питанию') }} />
          <Stack.Screen name="body-weight" options={{ ...withHeader, title: t('Вес тела') }} />
          <Stack.Screen name="exercises/index" options={{ ...withHeader, title: t('Упражнения') }} />
          <Stack.Screen name="exercises/[exerciseId]" options={{ ...withHeader, title: t('Упражнение') }} />
          <Stack.Screen
            name="exercises/new"
            options={{ ...withHeader, presentation: 'modal', title: t('Новое упражнение') }}
          />
          <Stack.Screen name="plan/[dayId]" options={{ ...withHeader, title: t('Изменить упражнения') }} />
          <Stack.Screen
            name="plan/pick"
            options={{ ...withHeader, presentation: 'modal', title: t('Выбрать упражнение') }}
          />
          <Stack.Screen
            name="check-in"
            options={{ ...withHeader, presentation: 'modal', title: t('Сон и самочувствие') }}
          />
          <Stack.Screen name="coach/history" options={{ ...withHeader, title: t('История решений') }} />
          <Stack.Screen name="coach/memory" options={{ ...withHeader, title: t('Память и предпочтения') }} />
          <Stack.Screen name="analytics" options={{ ...withHeader, title: t('Аналитика') }} />
          <Stack.Screen name="about" options={{ ...withHeader, title: t('О приложении') }} />
          <Stack.Screen name="design-system" options={{ ...withHeader, title: t('Дизайн-система') }} />
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
        <ErrorState message={t('Экран не открылся. Ваши записи не затронуты.')} onRetry={retry} />
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
