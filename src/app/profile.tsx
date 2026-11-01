import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { ChoiceGroup } from '@/components/choice-group';
import {
  type AccentName,
  AppText,
  Button,
  ListGroup,
  ListRow,
  ListSwitch,
  Panel,
  Screen,
  type ThemePreference,
  accentNames,
  useTheme,
} from '@/design-system';
import {
  equipmentLabels,
  experienceHints,
  experienceLabels,
  goalLabels,
  limitationLabels,
} from '@/features/profile/labels';
import { describeFailure } from '@/lib/describe-failure';
import { t } from '@/lib/i18n';

const themeChoices: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: t('Как на iPhone') },
  { value: 'dark', label: t('Тёмная') },
  { value: 'light', label: t('Светлая') },
];

const accentLabels: Record<AccentName, string> = {
  cyan: t('Голубой'),
  violet: t('Фиолетовый'),
  green: t('Зелёный'),
  orange: t('Оранжевый'),
  rose: t('Розовый'),
};

export default function ProfileScreen() {
  const {
    autoRestEnabled,
    changeAccent,
    changeAutoRest,
    changeHaptics,
    changeSound,
    changeThemePreference,
    hapticsEnabled,
    soundEnabled,
    profile,
  } = useAppData();
  const { theme, preference } = useTheme();
  const { colors } = theme;
  const [message, setMessage] = useState<string | null>(null);

  const saveSetting = async (save: Promise<void>) => {
    setMessage(null);
    try {
      await save;
    } catch (error) {
      console.error(error);
      setMessage(t('Настройка действует до перезапуска: сохранить её не удалось. {0}', { 0: describeFailure(error) }));
    }
  };

  return (
    <Screen scroll>
      {profile ? (
        <AppText accessibilityRole="header" variant="scoreLarge">
          {profile.name}
        </AppText>
      ) : (
        <AppText accessibilityRole="header" variant="title">
          {t('Профиль')}
        </AppText>
      )}

      {profile ? (
        <ListGroup title={t('Анкета')}>
          <ListRow title={t('Цель')} value={goalLabels[profile.goal]} />
          <ListRow
            subtitle={experienceHints[profile.experience]}
            title={t('Опыт')}
            value={experienceLabels[profile.experience]}
          />
          <ListRow
            title={t('Режим')}
            value={t('{0} дн. в неделю по {1} мин', { 0: profile.daysPerWeek, 1: profile.sessionMinutes })}
          />
          <ListRow title={t('Условия')} value={equipmentLabels[profile.equipment]} />
          {profile.limitations.length > 0 ? (
            <ListRow
              subtitle={profile.limitations.map((item) => limitationLabels[item]).join(', ')}
              title={t('Ограничения')}
            />
          ) : null}
          <ListRow
            accessibilityLabel={t('Изменить ответы и план')}
            onPress={() => router.push('/edit-profile')}
            title={t('Изменить ответы и план')}
            tone="accent"
          />
        </ListGroup>
      ) : null}

      <ListGroup title={t('Тренировка')}>
        <ListSwitch
          onChange={(enabled) => saveSetting(changeAutoRest(enabled))}
          subtitle={t('Таймер запускается после записанного подхода')}
          title={t('Отдых сам после подхода')}
          value={autoRestEnabled}
        />
        <ListSwitch
          onChange={(enabled) => saveSetting(changeSound(enabled))}
          title={t('Звук окончания отдыха')}
          value={soundEnabled}
        />
        <ListSwitch
          onChange={(enabled) => saveSetting(changeHaptics(enabled))}
          title={t('Тактильный отклик')}
          value={hapticsEnabled}
        />
      </ListGroup>

      <Panel>
        <ChoiceGroup
          choices={themeChoices}
          isSelected={(value) => preference === value}
          label={t('Тема')}
          onSelect={(value) => saveSetting(changeThemePreference(value))}
        />
        <ChoiceGroup
          choices={accentNames.map((value) => ({ value, label: accentLabels[value] }))}
          isSelected={(value) => theme.accent === value}
          label={t('Цвет оформления')}
          onSelect={(value) => saveSetting(changeAccent(value))}
        />
      </Panel>

      {message ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {message}
        </AppText>
      ) : null}

      <ListGroup>
        <ListRow
          accessibilityLabel={t('Ваши данные')}
          icon={{ name: 'externaldrive', glyph: '▤', color: colors.accent }}
          onPress={() => router.push('/data')}
          subtitle={t('Резервная копия, экспорт, удаление')}
          title={t('Ваши данные')}
        />
        <ListRow
          accessibilityLabel={t('О приложении')}
          icon={{ name: 'info.circle', glyph: 'i', color: colors.accent }}
          onPress={() => router.push('/about')}
          title={t('О приложении')}
        />
        {__DEV__ ? (
          <ListRow
            accessibilityLabel={t('Открыть дизайн-систему')}
            icon={{ name: 'paintpalette', glyph: '◐', color: colors.accent }}
            onPress={() => router.push('/design-system')}
            title={t('Открыть дизайн-систему')}
          />
        ) : null}
      </ListGroup>

      <Button label={t('Закрыть')} variant="plain" onPress={() => router.back()} />
    </Screen>
  );
}
