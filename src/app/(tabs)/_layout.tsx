import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/design-system';

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
        <NativeTabs.Trigger.Label>Главная</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="workouts">
        <NativeTabs.Trigger.Label>Тренировки</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'dumbbell', selected: 'dumbbell.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="coach">
        <NativeTabs.Trigger.Label>Coach</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'message', selected: 'message.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="nutrition">
        <NativeTabs.Trigger.Label>Питание</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="fork.knife" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="progress">
        <NativeTabs.Trigger.Label>Прогресс</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
