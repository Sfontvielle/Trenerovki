import type { Database, DatabaseExecutor } from '../data-platform/database';
import { generatePlan } from '../program/generate-plan';
import { replaceProgram } from '../program/program-repository';
import { getProfile } from '../profile/profile-repository';
import { type CoachFacts, type ProposalChange, type ProposalDraft, type ProposalKind, passesGuardrails } from './proposals';
import { t } from '@/lib/i18n';

const DEFER_MS = 7 * 24 * 60 * 60 * 1000;
const REJECTED_MEMORY_MS = 28 * 24 * 60 * 60 * 1000;
const DELOAD_KEY = 'deload_until';

export type ProposalStatus = 'open' | 'accepted' | 'rejected' | 'deferred' | 'undone';

export type Proposal = ProposalDraft & {
  id: string;
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
  planVersionId: string | null;
};

type ProposalRow = {
  id: string;
  kind: ProposalKind;
  fingerprint: string;
  title: string;
  why: string;
  change: string;
  status: ProposalStatus;
  created_at: string;
  decided_at: string | null;
  deferred_until: string | null;
  plan_version_id: string | null;
};

export class CoachError extends Error {
  constructor(readonly problem: 'stale' | 'not_found') {
    super(`Coach proposal cannot be applied: ${problem}`);
    this.name = 'CoachError';
  }
}

function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    kind: row.kind,
    fingerprint: row.fingerprint,
    title: row.title,
    why: row.why,
    change: JSON.parse(row.change) as ProposalChange,
    status: row.status,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
    planVersionId: row.plan_version_id,
  };
}

// Open proposals always mirror the current facts. A decided one stays quiet:
// accepted or rejected for four weeks, deferred until its date.
export async function syncProposals(
  database: Database,
  drafts: ProposalDraft[],
  now: Date,
  createId: () => string,
) {
  const rememberedSince = new Date(now.getTime() - REJECTED_MEMORY_MS).toISOString();
  const timestamp = now.toISOString();

  await database.transaction(async (tx) => {
    await tx.run("DELETE FROM coach_proposal WHERE status = 'open'");
    for (const draft of drafts) {
      const quiet = await tx.first(
        `SELECT id FROM coach_proposal
         WHERE fingerprint = ?
           AND ((status IN ('accepted', 'rejected', 'undone') AND decided_at >= ?)
             OR (status = 'deferred' AND deferred_until > ?))
         LIMIT 1`,
        [draft.fingerprint, rememberedSince, timestamp],
      );
      if (!quiet) {
        await tx.run(
          `INSERT INTO coach_proposal (id, kind, fingerprint, title, why, change, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'open', ?)`,
          [createId(), draft.kind, draft.fingerprint, draft.title, draft.why, JSON.stringify(draft.change), timestamp],
        );
      }
    }
  });
}

export async function listOpenProposals(database: Database) {
  const rows = await database.all<ProposalRow>(
    "SELECT * FROM coach_proposal WHERE status = 'open' ORDER BY created_at, rowid",
  );
  return rows.map(toProposal);
}

export async function listDecidedProposals(database: DatabaseExecutor) {
  const rows = await database.all<ProposalRow>(
    "SELECT * FROM coach_proposal WHERE status != 'open' ORDER BY decided_at DESC, rowid DESC",
  );
  return rows.map(toProposal);
}

// A plan snapshot already contains every earlier decision, so undoing one out
// of order would bring back what was undone and drop what came after it.
export function undoableProposals(decided: Proposal[]) {
  const accepted = decided.filter(({ status }) => status === 'accepted');
  const latestPlanChange = accepted.find(({ change }) => change.type !== 'deload');
  return accepted.filter(({ id, change }) => change.type === 'deload' || id === latestPlanChange?.id);
}

export type PlanVersion = {
  id: string;
  createdAt: string;
  reason: string;
};

async function readPlanTables(tx: DatabaseExecutor) {
  return {
    days: await tx.all('SELECT * FROM program_day ORDER BY position'),
    exercises: await tx.all('SELECT * FROM program_exercise ORDER BY program_day_id, position'),
    profile: await tx.first<{ days_per_week: number; training_days: string }>(
      'SELECT days_per_week, training_days FROM profile',
    ),
  };
}

export async function savePlanVersion(
  tx: DatabaseExecutor,
  reason: string,
  createId: () => string,
  now: Date,
) {
  const id = createId();
  await tx.run('INSERT INTO plan_version (id, created_at, reason, snapshot) VALUES (?, ?, ?, ?)', [
    id,
    now.toISOString(),
    reason,
    JSON.stringify(await readPlanTables(tx)),
  ]);
  return id;
}

export async function listPlanVersions(database: Database): Promise<PlanVersion[]> {
  const rows = await database.all<{ id: string; created_at: string; reason: string }>(
    'SELECT id, created_at, reason FROM plan_version ORDER BY created_at DESC, rowid DESC',
  );
  return rows.map((row) => ({ id: row.id, createdAt: row.created_at, reason: row.reason }));
}

type Row = Record<string, string | number | null>;

async function restoreVersion(tx: DatabaseExecutor, versionId: string) {
  const version = await tx.first<{ snapshot: string }>('SELECT snapshot FROM plan_version WHERE id = ?', [versionId]);
  if (!version) {
    throw new CoachError('not_found');
  }
  const snapshot = JSON.parse(version.snapshot) as {
    days: Row[];
    exercises: Row[];
    profile: { days_per_week: number; training_days: string } | null;
  };
  await tx.run('DELETE FROM program_day');
  for (const [table, rows] of [
    ['program_day', snapshot.days],
    ['program_exercise', snapshot.exercises],
  ] as const) {
    for (const row of rows) {
      const keys = Object.keys(row);
      await tx.run(
        `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
        Object.values(row),
      );
    }
  }
  if (snapshot.profile) {
    await tx.run('UPDATE profile SET days_per_week = ?, training_days = ?', [
      snapshot.profile.days_per_week,
      snapshot.profile.training_days,
    ]);
  }
}

export async function restorePlanVersion(
  database: Database,
  versionId: string,
  createId: () => string,
  now: Date,
) {
  await database.transaction(async (tx) => {
    await savePlanVersion(tx, t('Перед возвратом к прежнему плану'), createId, now);
    await restoreVersion(tx, versionId);
  });
}

async function setDeload(tx: DatabaseExecutor, day: string | null, now: Date) {
  if (day === null) {
    await tx.run('DELETE FROM settings WHERE key = ?', [DELOAD_KEY]);
    return;
  }
  await tx.run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    [DELOAD_KEY, day, now.toISOString()],
  );
}

export async function getDeloadUntil(database: Database) {
  const row = await database.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', [DELOAD_KEY]);
  return row?.value ?? null;
}

export function isDeloadActive(deloadUntil: string | null, today: string) {
  return deloadUntil !== null && deloadUntil >= today;
}

async function applyChange(
  tx: DatabaseExecutor,
  change: ProposalChange,
  createId: () => string,
  now: Date,
  excluded: string[],
) {
  switch (change.type) {
    case 'replace':
      await tx.run(
        `UPDATE program_exercise
         SET exercise_id = ?, reps_min = ?, reps_max = ?, target_duration_sec = ?
         WHERE id = ?`,
        [
          change.toExerciseId,
          change.target.repsMin,
          change.target.repsMax,
          change.target.targetDurationSec,
          change.programExerciseId,
        ],
      );
      return;
    case 'sets':
      await tx.run('UPDATE program_exercise SET target_sets = ? WHERE id = ?', [change.to, change.programExerciseId]);
      return;
    case 'deload':
      await setDeload(tx, change.untilDay, now);
      return;
    case 'days': {
      const profile = await getProfile(tx);
      if (!profile) {
        throw new CoachError('stale');
      }
      // The chosen weekdays no longer match the new count, so they are cleared.
      await tx.run("UPDATE profile SET days_per_week = ?, training_days = '[]'", [change.to]);
      await replaceProgram(tx, generatePlan({ ...profile, daysPerWeek: change.to, excluded }), createId);
    }
  }
}

function describeReason(proposal: Pick<Proposal, 'title'>) {
  return t('Перед предложением Coach: {0}', { 0: proposal.title });
}

type Decision = {
  facts: CoachFacts;
  now: Date;
  createId: () => string;
  // Lets the user pick another exercise than the one proposed.
  change?: ProposalChange;
};

export async function acceptProposal(database: Database, proposalId: string, { facts, now, createId, change }: Decision) {
  await database.transaction(async (tx) => {
    const row = await tx.first<ProposalRow>("SELECT * FROM coach_proposal WHERE id = ? AND status = 'open'", [proposalId]);
    if (!row) {
      throw new CoachError('not_found');
    }
    const proposal = toProposal(row);
    const applied = change ?? proposal.change;
    if (!passesGuardrails({ change: applied }, facts)) {
      throw new CoachError('stale');
    }
    const versionId = await savePlanVersion(tx, describeReason(proposal), createId, now);
    await applyChange(tx, applied, createId, now, [...facts.avoided, ...facts.discomfort]);
    await tx.run(
      `UPDATE coach_proposal SET status = 'accepted', decided_at = ?, plan_version_id = ?, change = ? WHERE id = ?`,
      [now.toISOString(), versionId, JSON.stringify(applied), proposalId],
    );
  });
}

export async function rejectProposal(database: Database, proposalId: string, now: Date) {
  await database.run(
    "UPDATE coach_proposal SET status = 'rejected', decided_at = ? WHERE id = ? AND status = 'open'",
    [now.toISOString(), proposalId],
  );
}

export async function deferProposal(database: Database, proposalId: string, now: Date) {
  await database.run(
    "UPDATE coach_proposal SET status = 'deferred', decided_at = ?, deferred_until = ? WHERE id = ? AND status = 'open'",
    [now.toISOString(), new Date(now.getTime() + DEFER_MS).toISOString(), proposalId],
  );
}

// Workout history is never touched: only the plan returns to its earlier state.
export async function undoProposal(database: Database, proposalId: string, now: Date) {
  await database.transaction(async (tx) => {
    const row = await tx.first<ProposalRow>("SELECT * FROM coach_proposal WHERE id = ? AND status = 'accepted'", [
      proposalId,
    ]);
    if (!row?.plan_version_id) {
      throw new CoachError('not_found');
    }
    const undoable = undoableProposals(await listDecidedProposals(tx));
    if (!undoable.some(({ id }) => id === proposalId)) {
      throw new CoachError('stale');
    }
    if (toProposal(row).change.type === 'deload') {
      await setDeload(tx, null, now);
    } else {
      await restoreVersion(tx, row.plan_version_id);
    }
    await tx.run("UPDATE coach_proposal SET status = 'undone', decided_at = ? WHERE id = ?", [
      now.toISOString(),
      proposalId,
    ]);
  });
}

export type MemoryKind = 'fact' | 'avoid_exercise';

export type MemoryEntry = {
  id: string;
  kind: MemoryKind;
  text: string;
  exerciseId: string | null;
  createdAt: string;
  updatedAt: string;
};

type MemoryRow = {
  id: string;
  kind: MemoryKind;
  text: string;
  exercise_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function listMemory(database: Database): Promise<MemoryEntry[]> {
  const rows = await database.all<MemoryRow>('SELECT * FROM coach_memory ORDER BY updated_at DESC, rowid DESC');
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    text: row.text,
    exerciseId: row.exercise_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function addMemory(
  database: Database,
  entry: Pick<MemoryEntry, 'id' | 'kind' | 'text' | 'exerciseId'>,
  now: Date,
) {
  await database.run(
    `INSERT INTO coach_memory (id, kind, text, exercise_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.kind, entry.text.trim(), entry.exerciseId, now.toISOString(), now.toISOString()],
  );
}

export async function updateMemory(database: Database, id: string, text: string, now: Date) {
  await database.run('UPDATE coach_memory SET text = ?, updated_at = ? WHERE id = ?', [
    text.trim(),
    now.toISOString(),
    id,
  ]);
}

export async function deleteMemory(database: Database, id: string) {
  await database.run('DELETE FROM coach_memory WHERE id = ?', [id]);
}

export async function listAvoidedExercises(database: Database) {
  const rows = await database.all<{ exercise_id: string }>(
    "SELECT exercise_id FROM coach_memory WHERE kind = 'avoid_exercise' AND exercise_id IS NOT NULL",
  );
  return rows.map(({ exercise_id }) => exercise_id);
}

// Tendencies only: nothing here counts as a preference until the user confirms it.
export async function listFrequentlyRemoved(database: Database, minimum: number) {
  const rows = await database.all<{ exercise_id: string; count: number }>(
    `SELECT json_extract(payload, '$.exerciseId') AS exercise_id, COUNT(*) AS count
     FROM workout_event WHERE type = 'exercise_removed'
     GROUP BY exercise_id HAVING count >= ? ORDER BY count DESC`,
    [minimum],
  );
  return rows.map(({ exercise_id }) => exercise_id);
}
