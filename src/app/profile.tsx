import { router } from 'expo-router';
import { useState } from 'react';

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
import {
  BackupError,
  type BackupProblem,
  deleteAllData,
  inspectBackup,
  restoreAllData,
} from '@/domains/data-platform/data-transfer';
import { pickBackup, shareBackup } from '@/features/profile/backup';
import {
  equipmentLabels,
  experienceHints,
  experienceLabels,
  goalLabels,
  limitationLabels,
} from '@/features/profile/labels';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatDate } from '@/lib/format';

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

const backupProblems: Record<BackupProblem, string> = {
  not_a_backup: 'Это не резервная копия IRONVANT.',
  too_new: 'Копия создана более новой версией приложения. Обновите IRONVANT.',
  damaged: 'Файл копии повреждён. Текущие данные не изменились.',
};

export default function ProfileScreen() {
  const {
    changeAccent,
    changeHaptics,
    changeThemePreference,
    database,
    engine,
    hapticsEnabled,
    profile,
    refreshProfile,
    reloadAll,
  } = useAppData();
  const { theme, preference } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const saveSetting = async (save: Promise<void>) => {
    setMessage(null);
    try {
      await save;
    } catch (error) {
      console.error(error);
      setMessage(`Настройка действует до перезапуска: сохранить её не удалось. ${describeFailure(error)}`);
    }
  };

  const saveBackup = async () => {
    setMessage(null);
    setNotice(null);
    try {
      if (await shareBackup(database)) {
        setNotice('Резервная копия сохранена.');
      }
    } catch (error) {
      console.error(error);
      setMessage(`Копия не создана. ${describeFailure(error)}`);
    }
  };

  const restoreBackup = async () => {
    setMessage(null);
    setNotice(null);
    try {
      if (await engine.getOpenSession()) {
        setMessage('Сначала завершите или отмените тренировку.');
        return;
      }
      const text = await pickBackup();
      if (text === null) {
        return;
      }
      const summary = await inspectBackup(database, text);
      const last = summary.lastWorkoutAt ? ` Последняя тренировка: ${formatDate(summary.lastWorkoutAt)}.` : '';
      const approved = await confirm({
        title: 'Заменить все данные?',
        message: `В копии: тренировок ${summary.workouts}, дней с питанием ${summary.foodDays}, записей веса ${summary.weights}.${last} Текущие данные будут удалены. Отменить замену нельзя: если они нужны, сначала сохраните резервную копию.`,
        confirmLabel: 'Заменить данные',
        destructive: true,
      });
      if (!approved) {
        return;
      }
      await restoreAllData(database, text);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof BackupError
          ? backupProblems[error.problem]
          : `Данные не восстановлены. Текущие данные не изменились. ${describeFailure(error)}`,
      );
      return;
    }
    try {
      await engine.recoverInterruptedSession().catch(console.error);
      await reloadAll();
      setNotice('Данные восстановлены из копии.');
    } catch (error) {
      console.error(error);
      setMessage('Данные восстановлены, но экран не обновился. Перезапустите приложение.');
    }
  };

  const deleteData = async () => {
    const approved = await confirm({
      title: 'Удалить все данные?',
      message: 'Будут удалены профиль, план, тренировки, питание, вес тела, ваши упражнения и настройки. Вернуть их можно только из резервной копии.',
      confirmLabel: 'Удалить всё',
      destructive: true,
    });
    if (!approved) {
      return;
    }

    setMessage(null);
    try {
      await deleteAllData(database);
    } catch (error) {
      console.error(error);
      setMessage(`Данные не удалены. ${describeFailure(error)}`);
      return;
    }
    try {
      await refreshProfile();
    } catch (error) {
      console.error(error);
      setMessage('Данные удалены, но экран не обновился. Перезапустите приложение.');
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
          <AppText variant="callout" tone="secondary">{`Опыт: ${experienceLabels[profile.experience].toLowerCase()}, ${experienceHints[profile.experience].toLowerCase()}`}</AppText>
          <AppText variant="callout" tone="secondary">
            {`Режим: ${profile.daysPerWeek} дн. в неделю по ${profile.sessionMinutes} мин`}
          </AppText>
          <AppText variant="callout" tone="secondary">{`Условия: ${equipmentLabels[profile.equipment]}`}</AppText>
          {profile.limitations.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              {`Ограничения: ${profile.limitations.map((item) => limitationLabels[item]).join(', ')}`}
            </AppText>
          ) : null}
          <Button
            label="Изменить ответы и план"
            variant="secondary"
            onPress={() => router.push('/edit-profile')}
          />
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
          label="Цвет оформления"
          onSelect={(value) => saveSetting(changeAccent(value))}
        />
        <ChoiceGroup
          choices={[
            { value: 'on', label: 'Включён' },
            { value: 'off', label: 'Выключен' },
          ]}
          isSelected={(value) => (value === 'on') === hapticsEnabled}
          label="Тактильный отклик"
          onSelect={(value) => saveSetting(changeHaptics(value === 'on'))}
        />
      </Panel>

      <Panel>
        <AppText variant="heading">Ваши данные</AppText>
        <AppText variant="callout" tone="secondary">
          IRONVANT хранит данные на этом iPhone и никуда их не отправляет. Они могут попасть в
          резервную копию iPhone, если она включена.
        </AppText>
        <AppText variant="callout" tone="secondary">
          Резервная копия — это незашифрованный файл с вашими ответами, планом, тренировками, питанием и
          весом. Храните его в надёжном месте и не пересылайте: открыть его может любой, у кого есть файл.
        </AppText>
        <Button label="Сохранить резервную копию" variant="secondary" onPress={saveBackup} />
        <Button label="Восстановить из копии" variant="secondary" onPress={restoreBackup} />
        <Button label="Удалить все данные" variant="secondary" onPress={deleteData} />
      </Panel>

      {message ? (
        <AppText accessibilityLiveRegion="polite" tone="danger">
          {message}
        </AppText>
      ) : null}
      {notice ? (
        <AppText accessibilityLiveRegion="polite" tone="success">
          {notice}
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
