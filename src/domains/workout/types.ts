import type { SessionState } from './state-machine';

export type WorkoutSet = {
  id: string;
  position: number;
  weightKg: number | null;
  reps: number;
  rir: number | null;
  completedAt: string;
};

export type SessionExercise = {
  id: string;
  sessionId: string;
  position: number;
  exerciseId: string;
  plannedSets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  sets: WorkoutSet[];
};

export type WorkoutSession = {
  id: string;
  programDayId: string | null;
  title: string;
  state: SessionState;
  startedAt: string;
  pausedAt: string | null;
  pausedMs: number;
  finishedAt: string | null;
  exercises: SessionExercise[];
};

export type PlannedExercise = {
  exerciseId: string;
  plannedSets: number | null;
  repsMin: number | null;
  repsMax: number | null;
};

export type SetInput = {
  weightKg: number | null;
  reps: number;
  rir: number | null;
};

export type WorkoutErrorCode =
  | 'session_already_open'
  | 'session_not_found'
  | 'exercise_not_found'
  | 'exercise_has_sets'
  | 'set_not_found'
  | 'invalid_transition'
  | 'session_not_active'
  | 'invalid_set';

export class WorkoutError extends Error {
  constructor(
    readonly code: WorkoutErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'WorkoutError';
  }
}
