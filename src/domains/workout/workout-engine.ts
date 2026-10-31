import type { Database, DatabaseExecutor } from '../data-platform/database';
import { type SessionCommand, type SessionState, nextState } from './state-machine';
import {
  type PlannedExercise,
  type SessionExercise,
  type SetInput,
  type SetKind,
  WorkoutError,
  type WorkoutSession,
  type WorkoutSet,
  setKinds,
} from './types';

const MAX_WEIGHT_KG = 1000;
const MAX_REPS = 1000;
const MAX_RIR = 10;
const MAX_NOTE_LENGTH = 200;
const MAX_DURATION_SEC = 24 * 60 * 60;
const MAX_DISTANCE_M = 1000 * 1000;
const DISCOMFORT_EVENT = 'discomfort_reported';
const DISCOMFORT_MEMORY_MS = 14 * 24 * 60 * 60 * 1000;

type SessionRow = {
  id: string;
  program_day_id: string | null;
  title: string;
  state: SessionState;
  started_at: string;
  paused_at: string | null;
  paused_ms: number;
  finished_at: string | null;
  last_activity_at: string;
  recovery_required: number;
};

type ExerciseRow = {
  id: string;
  session_id: string;
  position: number;
  exercise_id: string;
  planned_sets: number | null;
  reps_min: number | null;
  reps_max: number | null;
  target_duration_sec: number | null;
  group_id: string | null;
};

type SetRow = {
  id: string;
  session_exercise_id: string;
  position: number;
  weight_kg: number | null;
  reps: number | null;
  rir: number | null;
  kind: SetKind;
  note: string | null;
  duration_sec: number | null;
  distance_m: number | null;
  completed_at: string;
};

export type EngineDependencies = {
  database: Database;
  createId: () => string;
  now: () => Date;
};

export function validateSet({
  weightKg,
  reps,
  rir,
  kind = 'working',
  note = null,
  durationSec = null,
  distanceM = null,
}: SetInput) {
  const validWeight =
    weightKg === null || (Number.isFinite(weightKg) && weightKg >= 0 && weightKg <= MAX_WEIGHT_KG);
  const validReps = reps === null || (Number.isInteger(reps) && reps > 0 && reps <= MAX_REPS);
  const validRir = rir === null || (Number.isInteger(rir) && rir >= 0 && rir <= MAX_RIR);
  const validDetails = setKinds.includes(kind) && (note === null || note.length <= MAX_NOTE_LENGTH);
  const validDuration =
    durationSec === null ||
    (Number.isInteger(durationSec) && durationSec > 0 && durationSec <= MAX_DURATION_SEC);
  const validDistance =
    distanceM === null || (Number.isFinite(distanceM) && distanceM > 0 && distanceM <= MAX_DISTANCE_M);
  const measured = reps !== null || durationSec !== null || distanceM !== null;

  if (!validWeight || !validReps || !validRir || !validDetails || !validDuration || !validDistance || !measured) {
    throw new WorkoutError('invalid_set', 'Set values are out of range');
  }
}

function toSet(row: SetRow): WorkoutSet {
  return {
    id: row.id,
    position: row.position,
    weightKg: row.weight_kg,
    reps: row.reps,
    rir: row.rir,
    kind: row.kind,
    note: row.note,
    durationSec: row.duration_sec,
    distanceM: row.distance_m,
    completedAt: row.completed_at,
  };
}

function toExercise(row: ExerciseRow, sets: WorkoutSet[]): SessionExercise {
  return {
    id: row.id,
    sessionId: row.session_id,
    position: row.position,
    exerciseId: row.exercise_id,
    plannedSets: row.planned_sets,
    repsMin: row.reps_min,
    repsMax: row.reps_max,
    targetDurationSec: row.target_duration_sec,
    groupId: row.group_id,
    sets,
  };
}

export class WorkoutEngine {
  private readonly database: Database;
  private readonly createId: () => string;
  private readonly now: () => Date;

  constructor({ database, createId, now }: EngineDependencies) {
    this.database = database;
    this.createId = createId;
    this.now = now;
  }

  // Every write commits its facts and its event together, and a repeated
  // operation id returns the first result instead of applying twice.
  private async apply(
    operationId: string,
    task: (tx: DatabaseExecutor, timestamp: string) => Promise<{
      sessionId: string;
      entityId: string;
      type: string;
      payload?: unknown;
    }>,
  ) {
    return this.database.transaction(async (tx) => {
      const existing = await tx.first<{ entity_id: string }>(
        'SELECT entity_id FROM workout_event WHERE operation_id = ?',
        [operationId],
      );
      if (existing) {
        return existing.entity_id;
      }

      const timestamp = this.now().toISOString();
      const { sessionId, entityId, type, payload } = await task(tx, timestamp);
      await tx.run(
        `INSERT INTO workout_event (operation_id, session_id, entity_id, type, payload, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [operationId, sessionId, entityId, type, JSON.stringify(payload ?? {}), timestamp],
      );
      await tx.run('UPDATE workout_session SET last_activity_at = ? WHERE id = ?', [
        timestamp,
        sessionId,
      ]);
      return entityId;
    });
  }

  private async requireSession(tx: DatabaseExecutor, sessionId: string) {
    const session = await tx.first<SessionRow>('SELECT * FROM workout_session WHERE id = ?', [
      sessionId,
    ]);
    if (!session) {
      throw new WorkoutError('session_not_found', 'Session does not exist');
    }
    return session;
  }

  private async requireActiveExercise(tx: DatabaseExecutor, sessionExerciseId: string) {
    const exercise = await tx.first<ExerciseRow>('SELECT * FROM session_exercise WHERE id = ?', [
      sessionExerciseId,
    ]);
    if (!exercise) {
      throw new WorkoutError('exercise_not_found', 'Session exercise does not exist');
    }
    const session = await this.requireSession(tx, exercise.session_id);
    if (session.state !== 'active') {
      throw new WorkoutError('session_not_active', 'Session is not active');
    }
    return exercise;
  }

  private async requireActiveSet(tx: DatabaseExecutor, setId: string) {
    const set = await tx.first<SetRow>('SELECT * FROM workout_set WHERE id = ?', [setId]);
    if (!set) {
      throw new WorkoutError('set_not_found', 'Set does not exist');
    }
    const exercise = await this.requireActiveExercise(tx, set.session_exercise_id);
    return { set, exercise };
  }

  private async requireCompletedSet(tx: DatabaseExecutor, setId: string) {
    const set = await tx.first<SetRow>('SELECT * FROM workout_set WHERE id = ?', [setId]);
    if (!set) {
      throw new WorkoutError('set_not_found', 'Set does not exist');
    }
    const exercise = await tx.first<ExerciseRow>('SELECT * FROM session_exercise WHERE id = ?', [
      set.session_exercise_id,
    ]);
    const session = exercise ? await this.requireSession(tx, exercise.session_id) : null;
    if (!exercise || !session || session.state !== 'completed') {
      throw new WorkoutError('session_not_completed', 'Session is not completed');
    }
    return { set, exercise, session };
  }

  private async insertExercise(
    tx: DatabaseExecutor,
    sessionId: string,
    position: number,
    planned: PlannedExercise,
  ) {
    const id = this.createId();
    await tx.run(
      `INSERT INTO session_exercise
         (id, session_id, position, exercise_id, planned_sets, reps_min, reps_max,
          target_duration_sec, group_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        sessionId,
        position,
        planned.exerciseId,
        planned.plannedSets,
        planned.repsMin,
        planned.repsMax,
        planned.targetDurationSec ?? null,
        planned.groupId ?? null,
      ],
    );
    return id;
  }

  startSession(input: {
    operationId: string;
    title: string;
    programDayId: string | null;
    exercises: PlannedExercise[];
  }) {
    return this.apply(input.operationId, async (tx, timestamp) => {
      const open = await tx.first(
        "SELECT id FROM workout_session WHERE state IN ('active', 'paused')",
      );
      if (open) {
        throw new WorkoutError('session_already_open', 'Another session is still open');
      }

      const sessionId = this.createId();
      await tx.run(
        `INSERT INTO workout_session (id, program_day_id, title, state, started_at, last_activity_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          sessionId,
          input.programDayId,
          input.title,
          nextState('planned', 'start') as SessionState,
          timestamp,
          timestamp,
        ],
      );
      for (const [index, exercise] of input.exercises.entries()) {
        await this.insertExercise(tx, sessionId, index + 1, exercise);
      }
      return { sessionId, entityId: sessionId, type: 'session_started' };
    });
  }

  private transition(sessionId: string, operationId: string, command: SessionCommand) {
    return this.apply(operationId, async (tx, timestamp) => {
      const session = await this.requireSession(tx, sessionId);
      const state = nextState(session.state, command);
      if (!state) {
        throw new WorkoutError(
          'invalid_transition',
          `Cannot ${command} a session in state ${session.state}`,
        );
      }

      const resumed = session.paused_at !== null && state === 'active';
      const pausedMs = resumed
        ? session.paused_ms + Date.parse(timestamp) - Date.parse(session.paused_at as string)
        : session.paused_ms;
      // A session finished from a pause ended when the pause began: the date
      // stays right even if the user closes it days after an interruption.
      const finishedAt =
        state === 'completed' || state === 'cancelled' ? (session.paused_at ?? timestamp) : null;

      await tx.run(
        `UPDATE workout_session
         SET state = ?, paused_at = ?, paused_ms = ?, finished_at = ?, recovery_required = 0
         WHERE id = ?`,
        [state, state === 'paused' ? timestamp : null, pausedMs, finishedAt, sessionId],
      );
      return { sessionId, entityId: sessionId, type: `session_${command}` };
    });
  }

  pauseSession(sessionId: string, operationId: string) {
    return this.transition(sessionId, operationId, 'pause');
  }

  resumeSession(sessionId: string, operationId: string) {
    return this.transition(sessionId, operationId, 'resume');
  }

  completeSession(sessionId: string, operationId: string) {
    return this.transition(sessionId, operationId, 'complete');
  }

  cancelSession(sessionId: string, operationId: string) {
    return this.transition(sessionId, operationId, 'cancel');
  }

  addExercise(sessionId: string, exerciseId: string, operationId: string) {
    return this.apply(operationId, async (tx) => {
      const session = await this.requireSession(tx, sessionId);
      if (session.state !== 'active') {
        throw new WorkoutError('session_not_active', 'Session is not active');
      }
      const last = await tx.first<{ position: number }>(
        'SELECT MAX(position) AS position FROM session_exercise WHERE session_id = ?',
        [sessionId],
      );
      const entityId = await this.insertExercise(tx, sessionId, (last?.position ?? 0) + 1, {
        exerciseId,
        plannedSets: null,
        repsMin: null,
        repsMax: null,
      });
      return { sessionId, entityId, type: 'exercise_added', payload: { exerciseId } };
    });
  }

  removeExercise(sessionExerciseId: string, operationId: string) {
    return this.apply(operationId, async (tx) => {
      const exercise = await this.requireActiveExercise(tx, sessionExerciseId);
      const sets = await tx.first<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_set WHERE session_exercise_id = ?',
        [sessionExerciseId],
      );
      if (sets?.count) {
        throw new WorkoutError('exercise_has_sets', 'Exercise already has recorded sets');
      }
      await tx.run('DELETE FROM session_exercise WHERE id = ?', [sessionExerciseId]);
      await tx.run(
        'UPDATE session_exercise SET position = position - 1 WHERE session_id = ? AND position > ?',
        [exercise.session_id, exercise.position],
      );
      return {
        sessionId: exercise.session_id,
        entityId: sessionExerciseId,
        type: 'exercise_removed',
        payload: { exerciseId: exercise.exercise_id },
      };
    });
  }

  // Linked exercises alternate: two make a superset, three a triset, more a circuit.
  linkWithNext(sessionExerciseId: string, operationId: string) {
    return this.apply(operationId, async (tx) => {
      const exercise = await this.requireActiveExercise(tx, sessionExerciseId);
      const next = await tx.first<ExerciseRow>(
        'SELECT * FROM session_exercise WHERE session_id = ? AND position = ?',
        [exercise.session_id, exercise.position + 1],
      );
      if (!next) {
        throw new WorkoutError('no_next_exercise', 'There is no exercise to link with');
      }
      const groupId = exercise.group_id ?? next.group_id ?? this.createId();
      await tx.run('UPDATE session_exercise SET group_id = ? WHERE id IN (?, ?)', [
        groupId,
        exercise.id,
        next.id,
      ]);
      if (next.group_id && next.group_id !== groupId) {
        await tx.run('UPDATE session_exercise SET group_id = ? WHERE session_id = ? AND group_id = ?', [
          groupId,
          exercise.session_id,
          next.group_id,
        ]);
      }
      return {
        sessionId: exercise.session_id,
        entityId: exercise.id,
        type: 'exercises_linked',
        payload: { groupId, with: next.id },
      };
    });
  }

  unlinkExercise(sessionExerciseId: string, operationId: string) {
    return this.apply(operationId, async (tx) => {
      const exercise = await this.requireActiveExercise(tx, sessionExerciseId);
      await tx.run('UPDATE session_exercise SET group_id = NULL WHERE id = ?', [exercise.id]);
      if (exercise.group_id) {
        const left = await tx.all<{ id: string }>(
          'SELECT id FROM session_exercise WHERE session_id = ? AND group_id = ?',
          [exercise.session_id, exercise.group_id],
        );
        if (left.length === 1) {
          await tx.run('UPDATE session_exercise SET group_id = NULL WHERE id = ?', [left[0].id]);
        }
      }
      return { sessionId: exercise.session_id, entityId: exercise.id, type: 'exercise_unlinked' };
    });
  }

  reportDiscomfort(sessionExerciseId: string, operationId: string) {
    return this.apply(operationId, async (tx) => {
      const exercise = await tx.first<ExerciseRow>('SELECT * FROM session_exercise WHERE id = ?', [
        sessionExerciseId,
      ]);
      if (!exercise) {
        throw new WorkoutError('exercise_not_found', 'Session exercise does not exist');
      }
      return {
        sessionId: exercise.session_id,
        entityId: sessionExerciseId,
        type: DISCOMFORT_EVENT,
        payload: { exerciseId: exercise.exercise_id },
      };
    });
  }

  async hasRecentDiscomfort(exerciseId: string) {
    const since = new Date(this.now().getTime() - DISCOMFORT_MEMORY_MS).toISOString();
    // The session exercise may be removed later, so the event's own payload decides.
    const event = await this.database.first(
      `SELECT sequence FROM workout_event
       WHERE type = ? AND json_extract(payload, '$.exerciseId') = ? AND occurred_at >= ?
       LIMIT 1`,
      [DISCOMFORT_EVENT, exerciseId, since],
    );
    return event !== null;
  }

  logSet(sessionExerciseId: string, input: SetInput, operationId: string) {
    return this.apply(operationId, async (tx, timestamp) => {
      validateSet(input);
      const exercise = await this.requireActiveExercise(tx, sessionExerciseId);
      const last = await tx.first<{ position: number }>(
        'SELECT MAX(position) AS position FROM workout_set WHERE session_exercise_id = ?',
        [sessionExerciseId],
      );
      const setId = this.createId();
      await tx.run(
        `INSERT INTO workout_set
           (id, session_exercise_id, position, weight_kg, reps, rir, kind, note,
            duration_sec, distance_m, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          setId,
          sessionExerciseId,
          (last?.position ?? 0) + 1,
          input.weightKg,
          input.reps,
          input.rir,
          input.kind ?? 'working',
          input.note ?? null,
          input.durationSec ?? null,
          input.distanceM ?? null,
          timestamp,
        ],
      );
      return { sessionId: exercise.session_id, entityId: setId, type: 'set_logged', payload: input };
    });
  }

  updateSet(setId: string, input: SetInput, operationId: string) {
    return this.apply(operationId, async (tx) => {
      validateSet(input);
      const { set, exercise } = await this.requireActiveSet(tx, setId);
      await this.writeSet(tx, setId, input);
      return {
        sessionId: exercise.session_id,
        entityId: setId,
        type: 'set_updated',
        payload: { before: toSet(set), after: input },
      };
    });
  }

  private async writeSet(tx: DatabaseExecutor, setId: string, input: SetInput) {
    await tx.run(
      `UPDATE workout_set
       SET weight_kg = ?, reps = ?, rir = ?, kind = ?, note = ?, duration_sec = ?, distance_m = ?
       WHERE id = ?`,
      [
        input.weightKg,
        input.reps,
        input.rir,
        input.kind ?? 'working',
        input.note ?? null,
        input.durationSec ?? null,
        input.distanceM ?? null,
        setId,
      ],
    );
  }

  // Finished workouts stay correctable, and the event log keeps what they said before.
  correctCompletedSet(setId: string, input: SetInput, operationId: string) {
    return this.apply(operationId, async (tx) => {
      validateSet(input);
      const { set, session } = await this.requireCompletedSet(tx, setId);
      await this.writeSet(tx, setId, input);
      return {
        sessionId: session.id,
        entityId: setId,
        type: 'completed_set_corrected',
        payload: { before: toSet(set), after: input },
      };
    });
  }

  deleteCompletedSet(setId: string, operationId: string) {
    return this.apply(operationId, async (tx) => {
      const { set, session } = await this.requireCompletedSet(tx, setId);
      const remaining = await tx.first<{ count: number }>(
        `SELECT COUNT(*) AS count FROM workout_set
         JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
         WHERE session_exercise.session_id = ?`,
        [session.id],
      );
      if ((remaining?.count ?? 0) <= 1) {
        throw new WorkoutError('last_set', 'A completed workout keeps at least one set');
      }
      await tx.run('DELETE FROM workout_set WHERE id = ?', [setId]);
      await tx.run(
        'UPDATE workout_set SET position = position - 1 WHERE session_exercise_id = ? AND position > ?',
        [set.session_exercise_id, set.position],
      );
      return {
        sessionId: session.id,
        entityId: setId,
        type: 'completed_set_deleted',
        payload: { before: toSet(set) },
      };
    });
  }

  deleteSet(setId: string, operationId: string) {
    return this.apply(operationId, async (tx) => {
      const { set, exercise } = await this.requireActiveSet(tx, setId);
      await tx.run('DELETE FROM workout_set WHERE id = ?', [setId]);
      await tx.run(
        'UPDATE workout_set SET position = position - 1 WHERE session_exercise_id = ? AND position > ?',
        [set.session_exercise_id, set.position],
      );
      return {
        sessionId: exercise.session_id,
        entityId: setId,
        type: 'set_deleted',
        payload: { before: toSet(set) },
      };
    });
  }

  // An active session found at launch means the app stopped mid-workout: time
  // after the last recorded activity must not count as training. The same
  // applies to a phone left idle, so callers can pass an allowed idle time.
  async recoverInterruptedSession(allowedIdleMs = 0) {
    const interrupted = await this.database.first<SessionRow>(
      "SELECT * FROM workout_session WHERE state = 'active'",
    );
    if (!interrupted) {
      return null;
    }
    const idleMs = this.now().getTime() - Date.parse(interrupted.last_activity_at);
    if (idleMs < allowedIdleMs) {
      return null;
    }

    await this.apply(this.createId(), async (tx) => {
      await tx.run(
        'UPDATE workout_session SET state = ?, paused_at = ?, recovery_required = 1 WHERE id = ?',
        [nextState(interrupted.state, 'pause'), interrupted.last_activity_at, interrupted.id],
      );
      return { sessionId: interrupted.id, entityId: interrupted.id, type: 'session_recovered' };
    });
    return interrupted.id;
  }

  async getSession(sessionId: string): Promise<WorkoutSession | null> {
    const row = await this.database.first<SessionRow>('SELECT * FROM workout_session WHERE id = ?', [
      sessionId,
    ]);
    if (!row) {
      return null;
    }

    const exerciseRows = await this.database.all<ExerciseRow>(
      'SELECT * FROM session_exercise WHERE session_id = ? ORDER BY position',
      [sessionId],
    );
    const setRows = await this.database.all<SetRow>(
      `SELECT workout_set.* FROM workout_set
       JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
       WHERE session_exercise.session_id = ?
       ORDER BY workout_set.position`,
      [sessionId],
    );

    return {
      id: row.id,
      programDayId: row.program_day_id,
      title: row.title,
      state: row.state,
      startedAt: row.started_at,
      pausedAt: row.paused_at,
      pausedMs: row.paused_ms,
      finishedAt: row.finished_at,
      recoveryRequired: row.recovery_required === 1,
      exercises: exerciseRows.map((exercise) =>
        toExercise(
          exercise,
          setRows.filter((set) => set.session_exercise_id === exercise.id).map(toSet),
        ),
      ),
    };
  }

  async getCompletedSet(setId: string) {
    const row = await this.database.first<SetRow & { exercise_id: string }>(
      `SELECT workout_set.*, session_exercise.exercise_id FROM workout_set
       JOIN session_exercise ON session_exercise.id = workout_set.session_exercise_id
       JOIN workout_session ON workout_session.id = session_exercise.session_id
       WHERE workout_set.id = ? AND workout_session.state = 'completed'`,
      [setId],
    );
    return row ? { set: toSet(row), exerciseId: row.exercise_id } : null;
  }

  async getOpenSession() {
    const row = await this.database.first<{ id: string }>(
      "SELECT id FROM workout_session WHERE state IN ('active', 'paused')",
    );
    return row ? this.getSession(row.id) : null;
  }

  async getLastPerformance(exerciseId: string, excludingSessionId?: string) {
    const [latest] = await this.getRecentPerformances(exerciseId, 1, excludingSessionId);
    return latest ?? [];
  }

  // Newest first, one list of sets per finished workout that included the exercise.
  async getRecentPerformances(exerciseId: string, count: number, excludingSessionId?: string) {
    const recent = await this.database.all<{ id: string }>(
      `SELECT session_exercise.id FROM session_exercise
       JOIN workout_session ON workout_session.id = session_exercise.session_id
       WHERE session_exercise.exercise_id = ?
         AND workout_session.state = 'completed'
         AND workout_session.id IS NOT ?
         AND EXISTS (
           SELECT 1 FROM workout_set WHERE workout_set.session_exercise_id = session_exercise.id
         )
       ORDER BY workout_session.finished_at DESC, session_exercise.position DESC
       LIMIT ?`,
      [exerciseId, excludingSessionId ?? null, count],
    );
    return Promise.all(
      recent.map(async ({ id }) => {
        const rows = await this.database.all<SetRow>(
          'SELECT * FROM workout_set WHERE session_exercise_id = ? ORDER BY position',
          [id],
        );
        return rows.map(toSet);
      }),
    );
  }
}
