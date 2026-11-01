import { useState } from 'react';

import { useAppData } from '@/app-data/app-data';
import { AppText, Button, ListGroup, ListRow, Panel, Screen, TextField, useTheme } from '@/design-system';
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
import { pickBackup, shareBackup, shareLatestSnapshot, shareWorkoutsCsv } from '@/features/profile/backup';
import { deleteMigrationSnapshots, latestMigrationSnapshot } from '@/features/profile/migration-snapshot';
import { confirm } from '@/lib/confirm';
import { describeFailure } from '@/lib/describe-failure';
import { formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';

const backupProblems: Record<BackupProblem, string> = {
  not_a_backup: t('Это не резервная копия IRONVANT.'),
  too_new: t('Копия создана более новой версией приложения. Обновите IRONVANT.'),
  damaged: t('Файл копии повреждён. Текущие данные не изменились.'),
};

export default function DataScreen() {
  const { database, engine, refreshProfile, reloadAll } = useAppData();
  const { theme } = useTheme();
  const { colors } = theme;
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [lockedBackup, setLockedBackup] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [encrypting, setEncrypting] = useState(false);
  const [snapshotAvailable, setSnapshotAvailable] = useState(() => latestMigrationSnapshot() !== null);

  const saveBackup = async () => {
    setMessage(null);
    setNotice(null);
    if (backupPassword && backupPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage(t('Пароль должен быть не короче {0} символов.', { 0: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (backupPassword !== passwordRepeat && backupPassword) {
      setMessage(t('Пароли не совпадают.'));
      return;
    }
    setEncrypting(true);
    try {
      if (await shareBackup(database, backupPassword || null)) {
        setNotice(t('Резервная копия передана. Проверьте, что файл появился там, куда вы его сохранили.'));
        setBackupPassword('');
        setPasswordRepeat('');
      }
    } catch (error) {
      console.error(error);
      setMessage(t('Копия не создана. {0}', { 0: describeFailure(error) }));
    } finally {
      setEncrypting(false);
    }
  };

  const saveSnapshot = async () => {
    setMessage(null);
    setNotice(null);
    try {
      if (await shareLatestSnapshot()) {
        setNotice(t('Копия передана. Проверьте, что файл появился там, куда вы его сохранили.'));
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
        setNotice(t('Таблица тренировок передана. Проверьте, что файл появился там, куда вы его сохранили.'));
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
    setEncrypting(true);
    try {
      const text = await decryptBackup(lockedBackup, unlockPassword);
      setEncrypting(false);
      setLockedBackup(null);
      setUnlockPassword('');
      await replaceFromBackup(text);
    } catch (error) {
      setEncrypting(false);
      console.error(error);
      setMessage(
        error instanceof WrongPasswordError
          ? t('Пароль не подходит или файл копии повреждён. Текущие данные не изменились.')
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
      message: t('Будут удалены все данные IRONVANT на этом iPhone: профиль, план, тренировки, питание, вес, отметки о сне и самочувствии, шаги, записи Coach и настройки. Вернуть их можно только из резервной копии, сохранённой заранее. Резервные копии iPhone и файлы, которые вы сохранили сами, это не затрагивает.'),
      confirmLabel: t('Удалить всё'),
      destructive: true,
    });
    if (!approved) {
      return;
    }

    setMessage(null);
    try {
      await deleteAllData(database);
      deleteMigrationSnapshots();
      setSnapshotAvailable(false);
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
    <Screen scroll belowHeader>
      <AppText variant="callout" tone="secondary">
        {t('IRONVANT хранит данные на этом iPhone и никуда их не отправляет, кроме одного случая: при сканировании номер штрихкода уходит в открытую базу Open Food Facts, а её сервер видит IP-адрес устройства. Если включено резервное копирование iPhone, данные приложения попадают в него.')}
      </AppText>

      <Panel>
        <AppText variant="heading">{t('Резервная копия')}</AppText>
        <AppText variant="callout" tone="secondary">
          {t('Резервная копия — это файл со всеми вашими данными: ответами и ограничениями, планом, тренировками, питанием, весом, отметками о сне и самочувствии, шагами и записями Coach. Без пароля его может открыть любой, у кого есть файл. С паролем он зашифрован, но забытый пароль восстановить нельзя.')}
        </AppText>
        <TextField
          hint={t('Необязательно. Не короче {0} символов', { 0: MIN_PASSWORD_LENGTH })}
          label={t('Пароль для копии')}
          onChangeText={setBackupPassword}
          secureTextEntry
          value={backupPassword}
        />
        {backupPassword ? (
          <TextField
            label={t('Повторите пароль')}
            onChangeText={setPasswordRepeat}
            secureTextEntry
            value={passwordRepeat}
          />
        ) : null}
        <Button label={t('Сохранить резервную копию')} loading={encrypting} onPress={saveBackup} />
      </Panel>

      {lockedBackup ? (
        <Panel>
          <TextField
            label={t('Пароль от копии')}
            onChangeText={setUnlockPassword}
            secureTextEntry
            value={unlockPassword}
          />
          <Button label={t('Открыть копию')} variant="secondary" loading={encrypting} onPress={unlockBackup} />
        </Panel>
      ) : null}

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

      <ListGroup>
        <ListRow
          accessibilityLabel={t('Восстановить из копии')}
          icon={{ name: 'arrow.down.doc', glyph: '↓', color: colors.accent }}
          onPress={restoreBackup}
          title={t('Восстановить из копии')}
        />
        {snapshotAvailable ? (
          <ListRow
            accessibilityLabel={t('Копия перед последним обновлением')}
            icon={{ name: 'clock.arrow.circlepath', glyph: '◷', color: colors.accent }}
            onPress={saveSnapshot}
            title={t('Копия перед последним обновлением')}
          />
        ) : null}
        <ListRow
          accessibilityLabel={t('Экспорт тренировок в таблицу')}
          icon={{ name: 'tablecells', glyph: '▦', color: colors.accent }}
          onPress={exportCsv}
          title={t('Экспорт тренировок в таблицу')}
        />
      </ListGroup>

      <Button label={t('Удалить все данные')} variant="danger" onPress={deleteData} />
    </Screen>
  );
}
