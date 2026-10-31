import { savePlanVersion } from '../coach/coach-repository';
import type { Database } from '../data-platform/database';
import type { PlannedDay } from '../program/generate-plan';
import { replaceProgram } from '../program/program-repository';
import type { Profile } from './profile';
import { saveProfile } from './profile-repository';
import { t } from '@/lib/i18n';

export async function saveAnswers(database: Database, profile: Profile, now: Date) {
  await database.transaction((tx) => saveProfile(tx, profile, now.toISOString()));
}

export async function completeOnboarding(
  database: Database,
  profile: Profile,
  plan: PlannedDay[],
  createId: () => string,
  now: Date,
) {
  await database.transaction(async (tx) => {
    const existing = await tx.first('SELECT id FROM program_day LIMIT 1');
    if (existing) {
      await savePlanVersion(tx, t('Перед новым планом по изменённым ответам'), createId, now);
    }
    await saveProfile(tx, profile, now.toISOString());
    await replaceProgram(tx, plan, createId);
  });
}
