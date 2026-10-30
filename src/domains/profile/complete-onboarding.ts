import type { Database } from '../data-platform/database';
import type { PlannedDay } from '../program/generate-plan';
import { replaceProgram } from '../program/program-repository';
import type { Profile } from './profile';
import { saveProfile } from './profile-repository';

export async function completeOnboarding(
  database: Database,
  profile: Profile,
  plan: PlannedDay[],
  createId: () => string,
  now: Date,
) {
  await database.transaction(async (tx) => {
    await saveProfile(tx, profile, now.toISOString());
    await replaceProgram(tx, plan, createId);
  });
}
