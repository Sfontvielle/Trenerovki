import type { Database, DatabaseExecutor } from '../data-platform/database';
import type { PlannedDay } from './generate-plan';

const DEFAULT_SETS = 3;
const DEFAULT_REPS_MIN = 8;
const DEFAULT_REPS_MAX = 12;

export type ProgramExercise = {
  id: string;
  exerciseId: string;
  targetSets: number;
  repsMin: number;
  repsMax: number;
};

export type ProgramDay = {
  id: string;
  position: number;
  name: string;
  exercises: ProgramExercise[];
};

export async function replaceProgram(
  tx: DatabaseExecutor,
  days: PlannedDay[],
  createId: () => string,
) {
  await tx.run('DELETE FROM program_day');
  for (const [dayIndex, day] of days.entries()) {
    const dayId = createId();
    await tx.run('INSERT INTO program_day (id, position, name) VALUES (?, ?, ?)', [
      dayId,
      dayIndex + 1,
      day.name,
    ]);
    for (const [index, exercise] of day.exercises.entries()) {
      await tx.run(
        `INSERT INTO program_exercise
           (id, program_day_id, position, exercise_id, target_sets, reps_min, reps_max)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          dayId,
          index + 1,
          exercise.exerciseId,
          exercise.targetSets,
          exercise.repsMin,
          exercise.repsMax,
        ],
      );
    }
  }
}

export async function getProgram(database: Database): Promise<ProgramDay[]> {
  const days = await database.all<{ id: string; position: number; name: string }>(
    'SELECT * FROM program_day ORDER BY position',
  );
  const rows = await database.all<{
    id: string;
    program_day_id: string;
    exercise_id: string;
    target_sets: number;
    reps_min: number;
    reps_max: number;
  }>('SELECT * FROM program_exercise ORDER BY position');

  return days.map((day) => ({
    ...day,
    exercises: rows
      .filter((row) => row.program_day_id === day.id)
      .map((row) => ({
        id: row.id,
        exerciseId: row.exercise_id,
        targetSets: row.target_sets,
        repsMin: row.reps_min,
        repsMax: row.reps_max,
      })),
  }));
}

export async function replaceProgramExercise(database: Database, id: string, exerciseId: string) {
  await database.run('UPDATE program_exercise SET exercise_id = ? WHERE id = ?', [exerciseId, id]);
}

export async function removeProgramExercise(database: Database, id: string) {
  await database.transaction(async (tx) => {
    const row = await tx.first<{ program_day_id: string; position: number }>(
      'SELECT program_day_id, position FROM program_exercise WHERE id = ?',
      [id],
    );
    if (!row) {
      return;
    }
    await tx.run('DELETE FROM program_exercise WHERE id = ?', [id]);
    await tx.run(
      'UPDATE program_exercise SET position = position - 1 WHERE program_day_id = ? AND position > ?',
      [row.program_day_id, row.position],
    );
  });
}

export async function addProgramExercise(
  database: Database,
  dayId: string,
  exerciseId: string,
  id: string,
) {
  await database.transaction(async (tx) => {
    const last = await tx.first<{
      position: number;
      target_sets: number;
      reps_min: number;
      reps_max: number;
    }>('SELECT * FROM program_exercise WHERE program_day_id = ? ORDER BY position DESC LIMIT 1', [dayId]);
    await tx.run(
      `INSERT INTO program_exercise
         (id, program_day_id, position, exercise_id, target_sets, reps_min, reps_max)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        dayId,
        (last?.position ?? 0) + 1,
        exerciseId,
        last?.target_sets ?? DEFAULT_SETS,
        last?.reps_min ?? DEFAULT_REPS_MIN,
        last?.reps_max ?? DEFAULT_REPS_MAX,
      ],
    );
  });
}

export async function getNextDay(database: Database, program: ProgramDay[]) {
  if (program.length === 0) {
    return null;
  }
  const last = await database.first<{ program_day_id: string }>(
    `SELECT program_day_id FROM workout_session
     WHERE state = 'completed' AND program_day_id IS NOT NULL
     ORDER BY finished_at DESC LIMIT 1`,
  );
  const lastIndex = program.findIndex((day) => day.id === last?.program_day_id);
  return program[(lastIndex + 1) % program.length];
}
