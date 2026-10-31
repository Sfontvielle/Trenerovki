import type { Database } from '../data-platform/database';
import type { MuscleGroup } from './catalog';

export type CustomExercise = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
};

export async function listCustomExercises(database: Database): Promise<CustomExercise[]> {
  const rows = await database.all<{ id: string; name: string; muscle_group: MuscleGroup }>(
    'SELECT id, name, muscle_group FROM custom_exercise ORDER BY name',
  );
  return rows.map((row) => ({ id: row.id, name: row.name, muscleGroup: row.muscle_group }));
}

export async function addCustomExercise(
  database: Database,
  exercise: CustomExercise,
  now: Date,
) {
  await database.run(
    'INSERT INTO custom_exercise (id, name, muscle_group, created_at) VALUES (?, ?, ?, ?)',
    [exercise.id, exercise.name.trim(), exercise.muscleGroup, now.toISOString()],
  );
}
