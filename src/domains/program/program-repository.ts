import type { Database, DatabaseExecutor } from '../data-platform/database';
import type { PlannedDay } from './generate-plan';

const DEFAULT_SETS = 3;

export type ProgramExercise = {
  id: string;
  exerciseId: string;
  targetSets: number;
  repsMin: number | null;
  repsMax: number | null;
  targetDurationSec: number | null;
  groupId: string | null;
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
           (id, program_day_id, position, exercise_id, target_sets, reps_min, reps_max,
            target_duration_sec, group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          createId(),
          dayId,
          index + 1,
          exercise.exerciseId,
          exercise.targetSets,
          exercise.repsMin,
          exercise.repsMax,
          exercise.targetDurationSec ?? null,
          exercise.groupId ?? null,
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
    reps_min: number | null;
    reps_max: number | null;
    target_duration_sec: number | null;
    group_id: string | null;
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
        targetDurationSec: row.target_duration_sec,
        groupId: row.group_id,
      })),
  }));
}

export type ExerciseTarget = {
  repsMin: number | null;
  repsMax: number | null;
  targetDurationSec: number | null;
};

export async function replaceProgramExercise(
  database: Database,
  id: string,
  exerciseId: string,
  target: ExerciseTarget,
) {
  await database.run(
    `UPDATE program_exercise
     SET exercise_id = ?, reps_min = ?, reps_max = ?, target_duration_sec = ?
     WHERE id = ?`,
    [exerciseId, target.repsMin, target.repsMax, target.targetDurationSec, id],
  );
}

export async function linkProgramExerciseWithNext(database: Database, id: string, createId: () => string) {
  await database.transaction(async (tx) => {
    const exercise = await tx.first<{ program_day_id: string; position: number; group_id: string | null }>(
      'SELECT program_day_id, position, group_id FROM program_exercise WHERE id = ?',
      [id],
    );
    const next = exercise
      ? await tx.first<{ id: string; group_id: string | null }>(
          'SELECT id, group_id FROM program_exercise WHERE program_day_id = ? AND position = ?',
          [exercise.program_day_id, exercise.position + 1],
        )
      : null;
    if (!exercise || !next) {
      return;
    }
    const groupId = exercise.group_id ?? next.group_id ?? createId();
    await tx.run('UPDATE program_exercise SET group_id = ? WHERE id IN (?, ?)', [groupId, id, next.id]);
    if (next.group_id && next.group_id !== groupId) {
      await tx.run('UPDATE program_exercise SET group_id = ? WHERE group_id = ?', [groupId, next.group_id]);
    }
  });
}

export async function unlinkProgramExercise(database: Database, id: string) {
  await database.transaction(async (tx) => {
    const exercise = await tx.first<{ group_id: string | null }>(
      'SELECT group_id FROM program_exercise WHERE id = ?',
      [id],
    );
    await tx.run('UPDATE program_exercise SET group_id = NULL WHERE id = ?', [id]);
    if (exercise?.group_id) {
      const left = await tx.all<{ id: string }>('SELECT id FROM program_exercise WHERE group_id = ?', [
        exercise.group_id,
      ]);
      if (left.length === 1) {
        await tx.run('UPDATE program_exercise SET group_id = NULL WHERE id = ?', [left[0].id]);
      }
    }
  });
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
  target: ExerciseTarget,
) {
  await database.transaction(async (tx) => {
    const last = await tx.first<{
      position: number;
      target_sets: number;
    }>('SELECT * FROM program_exercise WHERE program_day_id = ? ORDER BY position DESC LIMIT 1', [dayId]);
    await tx.run(
      `INSERT INTO program_exercise
         (id, program_day_id, position, exercise_id, target_sets, reps_min, reps_max,
          target_duration_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        dayId,
        (last?.position ?? 0) + 1,
        exerciseId,
        last?.target_sets ?? DEFAULT_SETS,
        target.repsMin,
        target.repsMax,
        target.targetDurationSec,
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
