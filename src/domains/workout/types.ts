import type { SessionState } from './state-machine';

export const setKinds = ['working', 'warmup', 'drop', 'rest_pause'] as const;
export type SetKind = (typeof setKinds)[number];

export type WorkoutSet = {
  id: string;
  position: number;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  kind: SetKind;
  note: string | null;
  durationSec: number | null;
  distanceM: number | null;
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
  targetDurationSec: number | null;
  groupId: string | null;
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
  recoveryRequired: boolean;
  exercises: SessionExercise[];
};

export type PlannedExercise = {
  exerciseId: string;
  plannedSets: number | null;
  repsMin: number | null;
  repsMax: number | null;
  targetDurationSec?: number | null;
  groupId?: string | null;
};

export type SetInput = {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  kind?: SetKind;
  note?: string | null;
  durationSec?: number | null;
  distanceM?: number | null;
};

export type WorkoutErrorCode =
  | 'session_already_open'
  | 'session_not_found'
  | 'session_not_completed'
  | 'exercise_not_found'
  | 'exercise_has_sets'
  | 'no_next_exercise'
  | 'set_not_found'
  | 'last_set'
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
