import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/design-system';
import { t } from '@/lib/i18n';

export default function TabsLayout() {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <NativeTabs
      backgroundColor={colors.surface}
      labelStyle={{ selected: { color: colors.accent } }}
      tintColor={colors.accent}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t('Главная')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <NativeTabs.Trigger.Label>{t('Тренировки')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="coach">
        <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'lightbulb', selected: 'lightbulb.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nutrition">
        <NativeTabs.Trigger.Label>{t('Питание')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="fork.knife" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>{t('Прогресс')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
