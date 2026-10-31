import { router } from 'expo-router';
import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { ChoiceGroup } from '@/components/choice-group';
import { type AccentName, AppText, Button, Panel, Screen, type ThemePreference, accentNames, useTheme, TextField } from '@/design-system';
import {
  MIN_PASSWORD_LENGTH,
  WrongPasswordError,
  decryptBackup,
  isEncryptedBackup,
} from '@/domains/data-platform/backup-crypto';
import {
  BackupError,
  type BackupProblem,
  deleteAllData,
  inspectBackup,
  restoreAllData,
} from '@/domains/data-platform/data-transfer';
import { pickBackup, shareBackup, shareWorkoutsCsv } from '@/features/profile/backup';
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

const backupProblems: Record<BackupProblem, string> = {
  not_a_backup: t('Это не резервная копия IRONVANT.'),
  too_new: t('Копия создана более новой версией приложения. Обновите IRONVANT.'),
  damaged: t('Файл копии повреждён. Текущие данные не изменились.'),
};

export default function ProfileScreen() {
  const {
    changeAccent,
    changeHaptics,
    changeSound,
    changeThemePreference,
    database,
    engine,
    hapticsEnabled,
    soundEnabled,
    profile,
    refreshProfile,
    reloadAll,
  } = useAppData();
  const { theme, preference } = useTheme();
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [lockedBackup, setLockedBackup] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');

  const saveSetting = async (save: Promise<void>) => {
    setMessage(null);
    try {
      await save;
    } catch (error) {
      console.error(error);
      setMessage(t('Настройка действует до перезапуска: сохранить её не удалось. {0}', { 0: describeFailure(error) }));
    }
  };

  const saveBackup = async () => {
    setMessage(null);
    setNotice(null);
    if (backupPassword && backupPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage(t('Пароль должен быть не короче {0} символов.', { 0: MIN_PASSWORD_LENGTH }));
      return;
    }
    try {
      if (await shareBackup(database, backupPassword || null)) {
        setNotice(t('Резервная копия сохранена.'));
        setBackupPassword('');
      }
    } catch (error) {
      console.error(error);
      setMessage(t('Копия не создана. {0}', { 0: describeFailure(error) }));
    }
  };

  const exportCsv = async () => {
    setMessage(null);
    setNotice(null);
    try {
      if (await shareWorkoutsCsv(database)) {
        setNotice(t('Таблица тренировок сохранена.'));
      }
    } catch (error) {
      console.error(error);
      setMessage(t('Таблица не создана. {0}', { 0: describeFailure(error) }));
    }
  };

  const restoreBackup = async () => {
    setMessage(null);
    setNotice(null);
    try {
      if (await engine.getOpenSession()) {
        setMessage(t('Сначала завершите или отмените тренировку.'));
        return;
      }
      const text = await pickBackup();
      if (text === null) {
        return;
      }
      if (isEncryptedBackup(text)) {
        setLockedBackup(text);
        return;
      }
      await replaceFromBackup(text);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof BackupError
          ? backupProblems[error.problem]
          : t('Данные не восстановлены. Текущие данные не изменились. {0}', { 0: describeFailure(error) }),
      );
    }
  };

  const unlockBackup = async () => {
    if (!lockedBackup) {
      return;
    }
    setMessage(null);
    try {
      const text = await decryptBackup(lockedBackup, unlockPassword);
      setLockedBackup(null);
      setUnlockPassword('');
      await replaceFromBackup(text);
    } catch (error) {
      console.error(error);
      setMessage(
        error instanceof WrongPasswordError
          ? t('Пароль не подходит к этой копии. Текущие данные не изменились.')
          : error instanceof BackupError
            ? backupProblems[error.problem]
            : t('Данные не восстановлены. Текущие данные не изменились. {0}', { 0: describeFailure(error) }),
      );
    }
  };

  const replaceFromBackup = async (text: string) => {
    try {
      const summary = await inspectBackup(database, text);
      const last = summary.lastWorkoutAt ? t(' Последняя тренировка: {0}.', { 0: formatDate(summary.lastWorkoutAt) }) : '';
      const approved = await confirm({
        title: t('Заменить все данные?'),
        message: t('В копии: тренировок {0}, дней с питанием {1}, записей веса {2}.{3} Текущие данные будут удалены. Отменить замену нельзя: если они нужны, сначала сохраните резервную копию.', { 0: summary.workouts, 1: summary.foodDays, 2: summary.weights, 3: last }),
        confirmLabel: t('Заменить данные'),
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
          : t('Данные не восстановлены. Текущие данные не изменились. {0}', { 0: describeFailure(error) }),
      );
      return;
    }
    try {
      await engine.recoverInterruptedSession().catch(console.error);
      await reloadAll();
      setNotice(t('Данные восстановлены из копии.'));
    } catch (error) {
      console.error(error);
      setMessage(t('Данные восстановлены, но экран не обновился. Перезапустите приложение.'));
    }
  };

  const deleteData = async () => {
    const approved = await confirm({
      title: t('Удалить все данные?'),
      message: t('Будут удалены профиль, план, тренировки, питание, вес тела, ваши упражнения и настройки. Вернуть их можно только из резервной копии.'),
      confirmLabel: t('Удалить всё'),
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
      setMessage(t('Данные не удалены. {0}', { 0: describeFailure(error) }));
      return;
    }
    try {
      await refreshProfile();
    } catch (error) {
      console.error(error);
      setMessage(t('Данные удалены, но экран не обновился. Перезапустите приложение.'));
    }
  };

  return (
    <Screen scroll>
      <AppText accessibilityRole="header" variant="title">
        {t('Профиль')}
      </AppText>

      {profile ? (
        <Panel>
          <AppText variant="heading">{profile.name}</AppText>
          <AppText variant="callout" tone="secondary">{t('Цель: {0}', { 0: goalLabels[profile.goal] })}</AppText>
          <AppText variant="callout" tone="secondary">{t('Опыт: {0}, {1}', { 0: experienceLabels[profile.experience].toLowerCase(), 1: experienceHints[profile.experience].toLowerCase() })}</AppText>
          <AppText variant="callout" tone="secondary">
            {t('Режим: {0} дн. в неделю по {1} мин', { 0: profile.daysPerWeek, 1: profile.sessionMinutes })}
          </AppText>
          <AppText variant="callout" tone="secondary">{t('Условия: {0}', { 0: equipmentLabels[profile.equipment] })}</AppText>
          {profile.limitations.length > 0 ? (
            <AppText variant="callout" tone="secondary">
              {t('Ограничения: {0}', { 0: profile.limitations.map((item) => limitationLabels[item]).join(', ') })}
            </AppText>
          ) : null}
          <Button
            label={t('Изменить ответы и план')}
            variant="secondary"
            onPress={() => router.push('/edit-profile')}
          />
        </Panel>
      ) : null}

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
        <ChoiceGroup
          choices={[
            { value: 'on', label: t('Включён') },
            { value: 'off', label: t('Выключен') },
          ]}
          isSelected={(value) => (value === 'on') === hapticsEnabled}
          label={t('Тактильный отклик')}
          onSelect={(value) => saveSetting(changeHaptics(value === 'on'))}
        />
        <ChoiceGroup
          choices={[
            { value: 'on', label: t('Включён') },
            { value: 'off', label: t('Выключен') },
          ]}
          isSelected={(value) => (value === 'on') === soundEnabled}
          label={t('Звук окончания отдыха')}
          onSelect={(value) => saveSetting(changeSound(value === 'on'))}
        />
      </Panel>

      <Panel>
        <AppText variant="heading">{t('Ваши данные')}</AppText>
        <AppText variant="callout" tone="secondary">
          {t('IRONVANT хранит данные на этом iPhone. Наружу уходит только номер штрихкода, когда вы сканируете продукт: его получает открытая база Open Food Facts. Они могут попасть в резервную копию iPhone, если она включена.')}
        </AppText>
        <AppText variant="callout" tone="secondary">
          {t('Резервная копия — это файл с вашими ответами, планом, тренировками, питанием и весом. Без пароля его может открыть любой, у кого есть файл. С паролем он зашифрован, но забытый пароль восстановить нельзя.')}
        </AppText>
        <TextField
          hint={t('Необязательно. Не короче {0} символов', { 0: MIN_PASSWORD_LENGTH })}
          label={t('Пароль для копии')}
          onChangeText={setBackupPassword}
          secureTextEntry
          value={backupPassword}
        />
        <Button label={t('Сохранить резервную копию')} variant="secondary" onPress={saveBackup} />
        <Button label={t('Восстановить из копии')} variant="secondary" onPress={restoreBackup} />
        {lockedBackup ? (
          <>
            <TextField
              label={t('Пароль от копии')}
              onChangeText={setUnlockPassword}
              secureTextEntry
              value={unlockPassword}
            />
            <Button label={t('Открыть копию')} variant="secondary" onPress={unlockBackup} />
          </>
        ) : null}
        <Button label={t('Экспорт тренировок в таблицу')} variant="secondary" onPress={exportCsv} />
        <Button label={t('Удалить все данные')} variant="secondary" onPress={deleteData} />
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

      <Button label={t('О приложении')} variant="secondary" onPress={() => router.push('/about')} />
      {__DEV__ ? (
        <Button
          label={t('Открыть дизайн-систему')}
          variant="secondary"
          onPress={() => router.push('/design-system')}
        />
      ) : null}
      <Button label={t('Закрыть')} variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}
