import type { Database } from '../data-platform/database';
import { exerciseName } from '../exercises/catalog';

type CsvRow = {
  finished_at: string;
  title: string;
  exercise_id: string;
  position: number;
  kind: string;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  duration_sec: number | null;
  distance_m: number | null;
  note: string | null;
};

const HEADER = 'date,workout,exercise,set,kind,weight_kg,reps,rir,duration_sec,distance_m,note';

// Spreadsheets run cells starting with these characters as formulas.
function cell(value: string | number | null) {
  if (value === null) {
    return '';
  }
  const text = String(value);
  const safe = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export async function exportWorkoutsCsv(database: Database) {
  const rows = await database.all<CsvRow>(
    `SELECT workout_session.finished_at, workout_session.title, session_exercise.exercise_id,
            workout_set.position, workout_set.kind, workout_set.weight_kg, workout_set.reps,
            workout_set.rir, workout_set.duration_sec, workout_set.distance_m, workout_set.note
     FROM workout_set
     JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
     JOIN workout_session ON workout_session.id = session_exercise.session_id
     WHERE workout_session.state = 'completed'
     ORDER BY workout_session.finished_at, session_exercise.position, workout_set.position`,
  );
  const lines = rows.map((row) =>
    [
      row.finished_at,
      row.title,
      exerciseName(row.exercise_id),
      row.position,
      row.kind,
      row.weight_kg,
      row.reps,
      row.rir,
      row.duration_sec,
      row.distance_m,
      row.note,
    ]
      .map(cell)
      .join(','),
  );
  return [HEADER, ...lines].join('\n');
}
