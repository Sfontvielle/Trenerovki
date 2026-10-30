import type { Database, DatabaseExecutor } from '../data-platform/database';
import type { DaysPerWeek, Equipment, Experience, Goal, Limitation, Profile, SessionMinutes, Sex } from './profile';

type ProfileRow = {
  name: string;
  sex: Sex | null;
  age: number;
  weight_kg: number | null;
  goal: Goal;
  experience: Experience;
  days_per_week: DaysPerWeek;
  session_minutes: SessionMinutes;
  equipment: Equipment;
  limitations: string;
};

const knownLimitations: Limitation[] = ['shoulders', 'knees', 'lower_back'];

function parseLimitations(stored: string) {
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? knownLimitations.filter((limitation) => parsed.includes(limitation))
      : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getProfile(database: Database): Promise<Profile | null> {
  const row = await database.first<ProfileRow>('SELECT * FROM profile WHERE id = 1');
  if (!row) {
    return null;
  }
  return {
    name: row.name,
    sex: row.sex,
    age: row.age,
    weightKg: row.weight_kg,
    goal: row.goal,
    experience: row.experience,
    daysPerWeek: row.days_per_week,
    sessionMinutes: row.session_minutes,
    equipment: row.equipment,
    limitations: parseLimitations(row.limitations),
  };
}

export async function saveProfile(tx: DatabaseExecutor, profile: Profile, timestamp: string) {
  await tx.run(
    `INSERT INTO profile (
       id, name, sex, age, weight_kg, goal, experience, days_per_week, session_minutes,
       equipment, limitations, created_at, updated_at
     ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name, sex = excluded.sex, age = excluded.age,
       weight_kg = excluded.weight_kg, goal = excluded.goal, experience = excluded.experience,
       days_per_week = excluded.days_per_week, session_minutes = excluded.session_minutes,
       equipment = excluded.equipment, limitations = excluded.limitations,
       updated_at = excluded.updated_at`,
    [
      profile.name.trim(),
      profile.sex,
      profile.age,
      profile.weightKg,
      profile.goal,
      profile.experience,
      profile.daysPerWeek,
      profile.sessionMinutes,
      profile.equipment,
      JSON.stringify(profile.limitations),
      timestamp,
      timestamp,
    ],
  );
}
