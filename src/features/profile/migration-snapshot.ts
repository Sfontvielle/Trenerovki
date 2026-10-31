import { Directory, File, Paths } from 'expo-file-system';

import type { Database } from '@/domains/data-platform/database';
import { exportAllData } from '@/domains/data-platform/data-transfer';

const SNAPSHOTS_KEPT = 3;

function snapshotDirectory() {
  return new Directory(Paths.document, 'migration-snapshots');
}

function createdAt(name: string) {
  return Number(name.match(/-(\d+)\.json$/)?.[1] ?? 0);
}

export function newestFirst<Named extends { name: string }>(files: Named[]) {
  return [...files].sort((first, second) => createdAt(second.name) - createdAt(first.name));
}

function snapshotFiles() {
  const directory = snapshotDirectory();
  if (!directory.exists) {
    return [];
  }
  return newestFirst(directory.list().filter((entry): entry is File => entry instanceof File));
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

    for (const entry of snapshotFiles().slice(SNAPSHOTS_KEPT)) {
      entry.delete();
    }
  } catch (error) {
    console.error(error);
  }
}

export function latestMigrationSnapshot() {
  try {
    return snapshotFiles()[0] ?? null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

// These files hold everything, so deleting all data must remove them too.
export function deleteMigrationSnapshots() {
  const directory = snapshotDirectory();
  if (directory.exists) {
    directory.delete();
  }
}
