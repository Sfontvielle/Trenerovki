import { type Exercise, type MovementPattern, exerciseTracking, exercises, findExercise } from '../exercises/catalog';
import type { DaysPerWeek, Experience, Goal, Profile, SessionMinutes } from '../profile/profile';
import { t } from '@/lib/i18n';

type PlanProfile = Pick<
  Profile,
  'goal' | 'experience' | 'daysPerWeek' | 'sessionMinutes' | 'equipment' | 'limitations'
> &
  Partial<Pick<Profile, 'baseline'>>;

export type PlannedDayExercise = {
  exerciseId: string;
  targetSets: number;
  repsMin: number | null;
  repsMax: number | null;
  targetDurationSec?: number | null;
  groupId?: string | null;
};

export type PlannedDay = {
  name: string;
  exercises: PlannedDayExercise[];
};

type DayTemplate = {
  name: string;
  patterns: MovementPattern[];
};

const MIN_EXERCISES_PER_DAY = 3;

const fullBodyA: DayTemplate = {
  name: t('Всё тело А'),
  patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'vertical_push', 'core'],
};
const fullBodyB: DayTemplate = {
  name: t('Всё тело Б'),
  patterns: ['hinge', 'vertical_push', 'vertical_pull', 'lunge', 'horizontal_push', 'core'],
};
const fullBodyC: DayTemplate = {
  name: t('Всё тело В'),
  patterns: ['squat', 'horizontal_pull', 'horizontal_push', 'lunge', 'biceps', 'triceps'],
};
const upperA: DayTemplate = {
  name: t('Верх тела А'),
  patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'biceps', 'triceps'],
};
const lowerA: DayTemplate = {
  name: t('Низ тела А'),
  patterns: ['squat', 'hinge', 'lunge', 'calves', 'core'],
};
const upperB: DayTemplate = {
  name: t('Верх тела Б'),
  patterns: ['vertical_push', 'vertical_pull', 'horizontal_push', 'horizontal_pull', 'triceps', 'biceps'],
};
const lowerB: DayTemplate = {
  name: t('Низ тела Б'),
  patterns: ['hinge', 'squat', 'lunge', 'calves', 'core'],
};
const upper: DayTemplate = { ...upperA, name: t('Верх тела') };
const lower: DayTemplate = { ...lowerA, name: t('Низ тела') };
const push: DayTemplate = {
  name: t('Жимовой день'),
  patterns: ['horizontal_push', 'vertical_push', 'horizontal_push', 'vertical_push', 'triceps'],
};
const pull: DayTemplate = {
  name: t('Тяговый день'),
  patterns: ['vertical_pull', 'horizontal_pull', 'hinge', 'biceps', 'core'],
};
const legs: DayTemplate = {
  name: t('День ног'),
  patterns: ['squat', 'hinge', 'lunge', 'calves', 'core'],
};

const splits: Record<DaysPerWeek, DayTemplate[]> = {
  2: [fullBodyA, fullBodyB],
  3: [fullBodyA, fullBodyB, fullBodyC],
  4: [upperA, lowerA, upperB, lowerB],
  5: [upper, lower, push, pull, legs],
};

const allPatterns: MovementPattern[] = [
  'squat',
  'horizontal_push',
  'hinge',
  'horizontal_pull',
  'lunge',
  'vertical_push',
  'vertical_pull',
  'core',
  'biceps',
  'triceps',
  'calves',
];

const compoundRepRanges: Record<Goal, { min: number; max: number }> = {
  strength: { min: 4, max: 6 },
  muscle: { min: 8, max: 12 },
  recomposition: { min: 8, max: 12 },
  fat_loss: { min: 10, max: 15 },
  maintenance: { min: 8, max: 12 },
};

const beginnerStrengthRange = { min: 8, max: 10 };
const isolationRange = { min: 10, max: 15 };

const setsByExperience: Record<Experience, number> = {
  beginner: 2,
  intermediate: 3,
  advanced: 4,
};

const exercisesPerSession: Record<SessionMinutes, number> = {
  30: 3,
  45: 4,
  60: 5,
  75: 6,
};

function repRange(exercise: Exercise | null, goal: Goal, experience: Experience) {
  if (exercise?.isolation) {
    return isolationRange;
  }
  return goal === 'strength' && experience === 'beginner'
    ? beginnerStrengthRange
    : compoundRepRanges[goal];
}

const HOLD_SECONDS = 30;
const MOBILITY_SECONDS = 60;
const CARDIO_SECONDS = 15 * 60;

export function targetFor(exerciseId: string, goal: Goal, experience: Experience) {
  const tracking = exerciseTracking(exerciseId);
  if (tracking !== 'reps') {
    const exercise = findExercise(exerciseId);
    const seconds =
      tracking === 'cardio' ? CARDIO_SECONDS : exercise?.category === 'mobility' ? MOBILITY_SECONDS : HOLD_SECONDS;
    return { repsMin: null, repsMax: null, targetDurationSec: seconds };
  }
  const range = repRange(findExercise(exerciseId), goal, experience);
  return { repsMin: range.min, repsMax: range.max, targetDurationSec: null };
}

const FINISHER_MIN_MINUTES = 45;
const WARM_UP_MIN_MINUTES = 60;
const cardioGoals: Goal[] = ['fat_loss', 'recomposition', 'maintenance'];

function pickOne(pool: Exercise[], pattern: MovementPattern, dayIndex: number) {
  const candidates = pool.filter((exercise) => exercise.pattern === pattern);
  return candidates.length > 0 ? candidates[dayIndex % candidates.length] : null;
}

function pickExercises(patterns: MovementPattern[], pool: Exercise[], dayIndex: number) {
  const chosen = new Map<string, Exercise>();

  for (const pattern of patterns) {
    const candidates = pool.filter((exercise) => exercise.pattern === pattern && !chosen.has(exercise.id));
    if (candidates.length > 0) {
      const exercise = candidates[dayIndex % candidates.length];
      chosen.set(exercise.id, exercise);
    }
  }

  return [...chosen.values()];
}

function rotated<Item>(items: Item[], offset: number) {
  const start = offset % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

export function generatePlan(profile: PlanProfile): PlannedDay[] {
  const { baseline, daysPerWeek, equipment, experience, goal, limitations, sessionMinutes } = profile;
  // Self-reported starting form counts alongside experience, so nobody meets
  // a demanding lift or a full push-up before they are ready for it.
  const cautious = experience === 'beginner' || baseline === 'low';
  const usable = exercises.filter(
    (exercise) =>
      exercise.tracking === 'reps' &&
      exercise.category === 'strength' &&
      exercise.equipment.includes(equipment) &&
      !exercise.loads.some((area) => limitations.includes(area)) &&
      (!cautious || (!exercise.demanding && (baseline !== 'low' || exercise.id !== 'push-up'))),
  );
  const pool = [
    ...usable.filter((exercise) => exercise.demanding),
    ...usable.filter((exercise) => !exercise.demanding),
  ];
  const limit = exercisesPerSession[sessionMinutes];
  const templates = splits[daysPerWeek];

  const fromTemplates = templates.map((template, index) => ({
    name: template.name,
    chosen: pickExercises(template.patterns, pool, index),
  }));

  // Limitations can empty a themed day, so the split falls back to neutral days
  // built from whatever movements are still available.
  const minimum = Math.min(MIN_EXERCISES_PER_DAY, limit);
  const days = fromTemplates.some(({ chosen }) => chosen.length < minimum)
    ? templates.map((_, index) => ({
        name: t('Тренировка {0}', { 0: index + 1 }),
        chosen: pickExercises(rotated(allPatterns, index * 3), pool, index),
      }))
    : fromTemplates;

  const extras = exercises.filter(
    (exercise) =>
      exercise.equipment.includes(equipment) &&
      !exercise.loads.some((area) => limitations.includes(area)) &&
      !exercise.demanding,
  );

  return days.map(({ name, chosen }, dayIndex) => {
    const warmUp = sessionMinutes >= WARM_UP_MIN_MINUTES ? pickOne(extras, 'mobility', dayIndex) : null;
    const finisher =
      sessionMinutes >= FINISHER_MIN_MINUTES && cardioGoals.includes(goal)
        ? pickOne(extras, 'cardio', dayIndex)
        : null;

    return {
      name,
      exercises: [
        ...(warmUp ? [{ exerciseId: warmUp.id, targetSets: 1, ...targetFor(warmUp.id, goal, experience) }] : []),
        ...chosen.slice(0, limit).map((exercise) => ({
          exerciseId: exercise.id,
          targetSets: setsByExperience[experience],
          ...targetFor(exercise.id, goal, experience),
        })),
        ...(finisher ? [{ exerciseId: finisher.id, targetSets: 1, ...targetFor(finisher.id, goal, experience) }] : []),
      ],
    };
  });
}
