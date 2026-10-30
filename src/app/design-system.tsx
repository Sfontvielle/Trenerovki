import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  type AccentName,
  AppText,
  Button,
  Chip,
  Panel,
  Screen,
  type ThemePreference,
  type TypographyVariant,
  accentColors,
  accentNames,
  useTheme,
} from '@/design-system';

const LOADING_DEMO_MS = 1500;

const themeOptions: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Как на iPhone' },
  { value: 'dark', label: 'Тёмная' },
  { value: 'light', label: 'Светлая' },
];

const accentLabels: Record<AccentName, string> = {
  cyan: 'Голубой',
  violet: 'Фиолетовый',
  green: 'Зелёный',
  orange: 'Оранжевый',
  rose: 'Розовый',
};

const typeSamples: { variant: TypographyVariant; text: string }[] = [
  { variant: 'display', text: 'Жим лёжа' },
  { variant: 'title', text: 'Тренировка груди' },
  { variant: 'heading', text: 'Подход 3 из 4' },
  { variant: 'body', text: '80 кг, 8 повторов, запас 2 повтора' },
  { variant: 'callout', text: 'В прошлый раз: 77,5 кг на 8 повторов' },
  { variant: 'caption', text: 'Отдых необязателен' },
];

const statusSamples = [
  { tone: 'success', text: 'Подход сохранён' },
  { tone: 'warning', text: 'Нет сети, данные останутся на устройстве' },
  { tone: 'danger', text: 'Не удалось сохранить подход' },
  { tone: 'info', text: 'Есть предложение от Coach' },
] as const;

export default function DesignSystemScreen() {
  const { theme, preference, setPreference, setAccent, reduceMotion } = useTheme();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!loading) {
      return;
    }
    const timer = setTimeout(() => setLoading(false), LOADING_DEMO_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  if (!__DEV__) {
    return <Redirect href="/" />;
  }

  const rowStyle = [styles.row, { gap: theme.spacing.s }];

  return (
    <Screen scroll belowHeader>
      <Panel>
        <AppText variant="heading">Тема</AppText>
        <View accessibilityRole="radiogroup" style={rowStyle}>
          {themeOptions.map(({ value, label }) => (
            <Chip
              key={value}
              label={label}
              selected={preference === value}
              onPress={() => setPreference(value)}
            />
          ))}
        </View>
        <AppText variant="callout" tone="secondary">
          {theme.mode === 'dark' ? 'Сейчас: тёмная тема' : 'Сейчас: светлая тема'}
        </AppText>
      </Panel>

      <Panel>
        <AppText variant="heading">Акцент</AppText>
        <View accessibilityRole="radiogroup" style={rowStyle}>
          {accentNames.map((name) => (
            <Chip
              key={name}
              label={accentLabels[name]}
              selected={theme.accent === name}
              onPress={() => setAccent(name)}
              leading={
                <View
                  style={{
                    backgroundColor: accentColors[name][theme.mode].solid,
                    borderRadius: theme.radii.full,
                    height: theme.sizes.swatch,
                    width: theme.sizes.swatch,
                  }}
                />
              }
            />
          ))}
        </View>
        <AppText variant="callout" tone="secondary">
          Здесь выбор действует до перезапуска. Постоянный выбор находится в профиле.
        </AppText>
      </Panel>

      <View style={{ gap: theme.spacing.m }}>
        <Button
          label={loading ? 'Загрузка' : 'Показать загрузку'}
          loading={loading}
          onPress={() => setLoading(true)}
        />
        <Button label="Вернуться назад" variant="secondary" onPress={() => router.back()} />
        <Button label="Недоступная кнопка" disabled onPress={() => {}} />
      </View>

      <Panel>
        <AppText variant="heading">Текст</AppText>
        {typeSamples.map(({ variant, text }) => (
          <AppText key={variant} variant={variant}>
            {text}
          </AppText>
        ))}
      </Panel>

      <Panel>
        <AppText variant="heading">Статусы</AppText>
        {statusSamples.map(({ tone, text }) => (
          <AppText key={tone} variant="callout" tone={tone}>
            {text}
          </AppText>
        ))}
      </Panel>

      <AppText variant="caption" tone="secondary">
        {reduceMotion ? 'Уменьшение движения: включено' : 'Уменьшение движения: выключено'}
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
