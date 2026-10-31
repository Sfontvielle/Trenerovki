import type { Database } from '../data-platform/database';
import type { Equipment } from '../profile/profile';
import type { CustomExerciseInfo, MuscleGroup, Tracking } from './catalog';

export type CustomExercise = CustomExerciseInfo;

export async function listCustomExercises(database: Database): Promise<CustomExercise[]> {
  const rows = await database.all<{
    id: string;
    name: string;
    muscle_group: MuscleGroup;
    tracking: Tracking;
    equipment: string;
  }>('SELECT id, name, muscle_group, tracking, equipment FROM custom_exercise ORDER BY name');
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    muscleGroup: row.muscle_group,
    tracking: row.tracking,
    equipment: JSON.parse(row.equipment) as Equipment[],
  }));
}

export async function addCustomExercise(
  database: Database,
  exercise: CustomExercise,
  now: Date,
) {
  await database.run(
    `INSERT INTO custom_exercise (id, name, muscle_group, tracking, equipment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      exercise.id,
      exercise.name.trim(),
      exercise.muscleGroup,
      exercise.tracking,
      JSON.stringify(exercise.equipment),
      now.toISOString(),
    ],
  );
}
