import { type MuscleGroup, exerciseName, findAlternatives, findExercise } from '../exercises/catalog';
import { type ExerciseTarget, type ProgramDay, type ProgramExercise } from '../program/program-repository';
import { targetFor } from '../program/generate-plan';
import { type DaysPerWeek, type Profile, allowedDaysPerWeek } from '../profile/profile';

export type ProposalChange =
  | {
      type: 'replace';
      programExerciseId: string;
      fromExerciseId: string;
      toExerciseId: string;
      target: ExerciseTarget;
    }
  | { type: 'sets'; programExerciseId: string; exerciseId: string; from: number; to: number }
  | { type: 'deload'; untilDay: string }
  | { type: 'days'; from: DaysPerWeek; to: DaysPerWeek };

export type ProposalKind = 'discomfort' | 'limited_zone' | 'plateau' | 'deload' | 'low_volume' | 'fewer_days';

export type ProposalDraft = {
  kind: ProposalKind;
  // The same advice is not repeated right after a decision on it.
  fingerprint: string;
  title: string;
  why: string;
  change: ProposalChange;
};

export type CoachFacts = {
  today: string;
  program: ProgramDay[];
  profile: Profile;
  discomfort: string[];
  plateaus: string[];
  avoided: string[];
  // Completed workouts in each of the last full weeks, newest first.
  workoutsByWeek: number[];
  lowReadinessDays: number;
  weeklySetsByGroup: Partial<Record<MuscleGroup, number>>;
  deloadUntil: string | null;
};

const DELOAD_DAYS = 7;
const WEEKS_BEFORE_DELOAD = 5;
const LOW_READINESS_LIMIT = 3;
const MISSED_WEEKS = 3;
const MIN_WEEKLY_SETS = 6;
const MAX_TARGET_SETS = 5;
const volumeGoals: Profile['goal'][] = ['muscle', 'recomposition', 'strength'];

function planEntries(program: ProgramDay[]) {
  return program.flatMap((day) => day.exercises);
}

function findReplacement(entry: ProgramExercise, facts: CoachFacts) {
  const inPlan = planEntries(facts.program).map(({ exerciseId }) => exerciseId);
  const [option] = findAlternatives(entry.exerciseId, {
    equipment: facts.profile.equipment,
    limitations: facts.profile.limitations,
    excluded: [...inPlan, ...facts.avoided, ...facts.discomfort],
  });
  return option ?? null;
}

function replaceDraft(
  kind: ProposalKind,
  entry: ProgramExercise,
  facts: CoachFacts,
  texts: (from: string, to: string) => { title: string; why: string },
): ProposalDraft | null {
  const replacement = findReplacement(entry, facts);
  if (!replacement) {
    return null;
  }
  const { goal, experience } = facts.profile;
  return {
    kind,
    fingerprint: `${kind}:${entry.exerciseId}`,
    ...texts(exerciseName(entry.exerciseId), replacement.name),
    change: {
      type: 'replace',
      programExerciseId: entry.id,
      fromExerciseId: entry.exerciseId,
      toExerciseId: replacement.id,
      target: targetFor(replacement.id, goal, experience),
    },
  };
}

function shiftDay(day: string, days: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const dayOfMonth = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${dayOfMonth}`;
}

export function buildProposals(facts: CoachFacts): ProposalDraft[] {
  const entries = planEntries(facts.program);
  const drafts: (ProposalDraft | null)[] = [];

  for (const entry of entries.filter(({ exerciseId }) => facts.discomfort.includes(exerciseId))) {
    drafts.push(
      replaceDraft('discomfort', entry, facts, (from, to) => ({
        title: `Заменить «${from}»`,
        why: `Вы отмечали дискомфорт в этом упражнении за последние 14 дней. Вместо него можно делать «${to}». Если боль не проходит, обратитесь к врачу.`,
      })),
    );
  }

  for (const entry of entries) {
    const limited = findExercise(entry.exerciseId)?.loads.some((area) => facts.profile.limitations.includes(area));
    if (limited && !facts.discomfort.includes(entry.exerciseId)) {
      drafts.push(
        replaceDraft('limited_zone', entry, facts, (from, to) => ({
          title: `Заменить «${from}»`,
          why: `Упражнение заметно нагружает зону из ваших ограничений. «${to}» нагружает её меньше.`,
        })),
      );
    }
  }

  const deloadActive = facts.deloadUntil !== null && facts.deloadUntil >= facts.today;
  const recentWeeks = facts.workoutsByWeek.slice(0, WEEKS_BEFORE_DELOAD);
  const steadyTraining =
    recentWeeks.length === WEEKS_BEFORE_DELOAD && recentWeeks.every((count) => count >= facts.profile.daysPerWeek);
  if (!deloadActive && (steadyTraining || facts.lowReadinessDays >= LOW_READINESS_LIMIT)) {
    drafts.push({
      kind: 'deload',
      fingerprint: `deload:${facts.today.slice(0, 7)}`,
      title: 'Лёгкая неделя',
      why: steadyTraining
        ? `Вы тренируетесь по плану ${WEEKS_BEFORE_DELOAD} недель подряд. Неделя с меньшим числом подходов поможет восстановиться.`
        : 'Несколько дней подряд вы отмечали низкую готовность. Неделя с меньшей нагрузкой может помочь восстановиться.',
      change: { type: 'deload', untilDay: shiftDay(facts.today, DELOAD_DAYS) },
    });
  }

  for (const exerciseId of facts.plateaus) {
    const entry = entries.find((item) => item.exerciseId === exerciseId);
    if (entry && !facts.discomfort.includes(exerciseId)) {
      drafts.push(
        replaceDraft('plateau', entry, facts, (from, to) => ({
          title: `Сменить «${from}»`,
          why: `Вес не растёт три тренировки подряд. Смена упражнения на «${to}» даст новый стимул. Это необязательно: можно продолжать прибавлять по одному повтору.`,
        })),
      );
    }
  }

  if (volumeGoals.includes(facts.profile.goal) && facts.workoutsByWeek[0] >= facts.profile.daysPerWeek) {
    for (const [group, sets] of Object.entries(facts.weeklySetsByGroup) as [MuscleGroup, number][]) {
      const entry = entries.find(
        (item) => findExercise(item.exerciseId)?.muscleGroup === group && item.targetSets < MAX_TARGET_SETS,
      );
      if (sets < MIN_WEEKLY_SETS && entry && !facts.discomfort.includes(entry.exerciseId) && !deloadActive) {
        drafts.push({
          kind: 'low_volume',
          fingerprint: `low_volume:${group}`,
          title: `Добавить подход: ${exerciseName(entry.exerciseId)}`,
          why: `На эту группу мышц за неделю пришлось подходов: ${sets}. Один дополнительный подход немного увеличит объём.`,
          change: {
            type: 'sets',
            programExerciseId: entry.id,
            exerciseId: entry.exerciseId,
            from: entry.targetSets,
            to: entry.targetSets + 1,
          },
        });
      }
    }
  }

  const missed = facts.workoutsByWeek.slice(0, MISSED_WEEKS);
  const lower = allowedDaysPerWeek.filter((days) => days < facts.profile.daysPerWeek).at(-1);
  if (
    lower !== undefined &&
    missed.length === MISSED_WEEKS &&
    missed.every((count) => count <= facts.profile.daysPerWeek - 2)
  ) {
    drafts.push({
      kind: 'fewer_days',
      fingerprint: `fewer_days:${facts.profile.daysPerWeek}`,
      title: `План на ${lower} тренировки в неделю`,
      why: `Три недели подряд тренировок заметно меньше плана. Более короткий план будет легче выполнять. История сохранится.`,
      change: { type: 'days', from: facts.profile.daysPerWeek, to: lower },
    });
  }

  return drafts.filter((draft): draft is ProposalDraft => draft !== null && passesGuardrails(draft, facts));
}

// Independent of how a proposal was produced. Accepting re-runs it, because
// the plan or the limitations may have changed since the proposal appeared.
export function passesGuardrails({ change }: Pick<ProposalDraft, 'change'>, facts: CoachFacts) {
  if (change.type === 'replace') {
    const target = findExercise(change.toExerciseId);
    const stillPlanned = planEntries(facts.program).some(
      (entry) => entry.id === change.programExerciseId && entry.exerciseId === change.fromExerciseId,
    );
    return (
      target !== null &&
      stillPlanned &&
      target.equipment.includes(facts.profile.equipment) &&
      !target.loads.some((area) => facts.profile.limitations.includes(area)) &&
      !facts.discomfort.includes(change.toExerciseId) &&
      !facts.avoided.includes(change.toExerciseId)
    );
  }
  if (change.type === 'sets') {
    return (
      change.to <= MAX_TARGET_SETS &&
      !facts.discomfort.includes(change.exerciseId) &&
      planEntries(facts.program).some(
        (entry) => entry.id === change.programExerciseId && entry.targetSets === change.from,
      )
    );
  }
  if (change.type === 'days') {
    return facts.profile.daysPerWeek === change.from;
  }
  return true;
}
