import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import { Share } from 'react-native';

import type { Database } from '@/domains/data-platform/database';
import { exportAllData } from '@/domains/data-platform/data-transfer';
import { dayKey } from '@/domains/nutrition/nutrition';

export async function shareBackup(database: Database) {
  const file = new File(Paths.cache, `ironvant-backup-${dayKey(new Date())}.json`);
  if (file.exists) {
    file.delete();
  }
  file.create();
  await file.write(await exportAllData(database));
  try {
    const { action } = await Share.share({ url: file.uri });
    return action === Share.sharedAction;
  } finally {
    if (file.exists) {
      file.delete();
    }
  }
}

export async function pickBackup() {
  const result = await getDocumentAsync({ type: ['application/json', 'text/plain'] });
  if (result.canceled) {
    return null;
  }
  return new File(result.assets[0].uri).text();
}
