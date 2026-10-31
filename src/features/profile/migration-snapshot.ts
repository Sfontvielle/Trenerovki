import { Directory, File, Paths } from 'expo-file-system';

import type { Database } from '@/domains/data-platform/database';
import { exportAllData } from '@/domains/data-platform/data-transfer';

const SNAPSHOTS_KEPT = 3;

function snapshotDirectory() {
  return new Directory(Paths.document, 'migration-snapshots');
}

// Migrations are transactional, so a failed copy must not stop the update:
// it only removes the extra safety net. Web builds have no document folder.
export async function saveMigrationSnapshot(database: Database, version: number) {
  if (version === 0) {
    return;
  }
  try {
    const directory = snapshotDirectory();
    if (!directory.exists) {
      directory.create({ intermediates: true });
    }
    const file = new File(directory, `before-update-v${version}-${Date.now()}.json`);
    file.create();
    await file.write(await exportAllData(database));

    const older = directory
      .list()
      .filter((entry): entry is File => entry instanceof File)
      .sort((first, second) => second.name.localeCompare(first.name))
      .slice(SNAPSHOTS_KEPT);
    for (const entry of older) {
      entry.delete();
    }
  } catch (error) {
    console.error(error);
  }
}
