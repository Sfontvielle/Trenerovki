import { router } from 'expo-router';
import { useState } from 'react';
import { Share } from 'react-native';

import { useAppData } from '@/app-data/app-data';
import { ChoiceGroup } from '@/components/choice-group';
import {
  type AccentName,
  AppText,
  Button,
  Panel,
  Screen,
  type ThemePreference,
  accentNames,
  useTheme,
} from '@/design-system';
import { deleteAllData, exportAllData } from '@/domains/data-platform/data-transfer';
import { equipmentLabels, experienceLabels, goalLabels, limitationLabels } from '@/features/profile/labels';
import { confirm } from '@/lib/confirm';

const themeChoices: { value: ThemePreference; label: string }[] = [
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

export default function ProfileScreen() {
  const { changeAccent, changeThemePreference, database, profile, refreshProfile } = useAppData();
  const { theme, preference } = useTheme();
  const [message, setMessage] = useState<string | null>(null);

  const saveSetting = async (save: Promise<void>) => {
    setMessage(null);
    try {
      await save;
    } catch (error) {
      console.error(error);
      setMessage('Настройка действует до перезапуска: сохранить её не удалось.');
    }
  };

  const exportData = async () => {
    setMessage(null);
    try {
      await Share.share({ message: await exportAllData(database) });
    } catch (error) {
      console.error(error);
      setMessage('Не удалось подготовить экспорт. Попробуйте ещё раз.');
    }
  };

  const deleteData = async () => {
    const approved = await confirm({
      title: 'Удалить все данные?',
      message: 'Профиль, план и вся история тренировок будут удалены с этого iPhone без возможности восстановления.',
      confirmLabel: 'Удалить всё',
      destructive: true,
    });
    if (!approved) {
      return;
    }
    try {
      await deleteAllData(database);
      await refreshProfile();
      router.replace('/welcome');
    } catch (error) {
      console.error(error);
      setMessage('Данные не удалены. Попробуйте ещё раз.');
    }
  };

  return (
    <Screen scroll>
      <AppText accessibilityRole="header" variant="title">
        Профиль
      </AppText>

      {profile ? (
        <Panel>
          <AppText variant="heading">{profile.name}</AppText>
          <AppText variant="callout" tone="secondary">{`Цель: ${goalLabels[profile.goal]}`}</AppText>
          <AppText variant="callout" tone="secondary">{`Опыт: ${experienceLabels[profile.experience]}`}</AppText>
          <AppText variant="callout" tone="secondary">
            {`Режим: ${profile.daysPerWeek} дн. в неделю по ${profile.sessionMinutes} мин`}
          </AppText>
          <AppText variant="callout" tone="secondary">{`Место: ${equipmentLabels[profile.equipment]}`}</AppText>
          {profile.limitations.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              {`Ограничения: ${profile.limitations.map((item) => limitationLabels[item]).join(', ')}`}
            </AppText>
          ) : null}
        </Panel>
      ) : null}

      <Panel>
        <ChoiceGroup
          choices={themeChoices}
          isSelected={(value) => preference === value}
          label="Тема"
          onSelect={(value) => saveSetting(changeThemePreference(value))}
        />
        <ChoiceGroup
          choices={accentNames.map((value) => ({ value, label: accentLabels[value] }))}
          isSelected={(value) => theme.accent === value}
          label="Акцент"
          onSelect={(value) => saveSetting(changeAccent(value))}
        />
      </Panel>

      <Panel>
        <AppText variant="heading">Ваши данные</AppText>
        <AppText variant="callout" tone="secondary">
          Всё хранится только на этом iPhone. Копии в облаке нет, поэтому после удаления приложения
          данные пропадут. Сохраняйте экспорт, если он вам нужен.
        </AppText>
        <Button label="Экспортировать данные" variant="secondary" onPress={exportData} />
        <Button label="Удалить все данные" variant="secondary" onPress={deleteData} />
      </Panel>

      {message ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {message}
        </AppText>
      ) : null}

      {__DEV__ ? (
        <Button
          label="Открыть дизайн-систему"
          variant="secondary"
          onPress={() => router.push('/design-system')}
        />
      ) : null}
      <Button label="Закрыть" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
