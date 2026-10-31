import { getRandomBytes } from 'expo-crypto';
import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';

import { encryptBackup } from '@/domains/data-platform/backup-crypto';
import type { Database } from '@/domains/data-platform/database';
import { exportAllData } from '@/domains/data-platform/data-transfer';
import { dayKey } from '@/domains/nutrition/nutrition';
import { exportWorkoutsCsv } from '@/domains/progress/workout-csv';
import { latestMigrationSnapshot } from '@/features/profile/migration-snapshot';

async function shareFile(name: string, content: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(content);
  try {
    const { action } = await Share.share({ url: file.uri });
    return action === Share.sharedAction;
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}

export async function shareBackup(database: Database, password: string | null) {
  const plain = await exportAllData(database);
  const content = password ? await encryptBackup(plain, password, getRandomBytes) : plain;
  return shareFile(`ironvant-backup-${dayKey(new Date())}.json`, content);
}

export async function shareLatestSnapshot() {
  const snapshot = latestMigrationSnapshot();
  if (!snapshot) {
    return false;
  }
  const { action } = await Share.share({ url: snapshot.uri });
  return action === Share.sharedAction;
}

export async function shareWorkoutsCsv(database: Database) {
  return shareFile(`ironvant-workouts-${dayKey(new Date())}.csv`, await exportWorkoutsCsv(database));
}

export async function pickBackup() {
  const result = await getDocumentAsync({ type: ['application/json', 'text/plain'] });
  if (result.canceled) {
    return null;
  }
  return new File(result.assets[0].uri).text();
}
