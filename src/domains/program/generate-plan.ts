import { type Exercise, type MovementPattern, exercises } from '../exercises/catalog';
import type { DaysPerWeek, Experience, Goal, Profile, SessionMinutes } from '../profile/profile';

type PlanProfile = Pick<
  Profile,
  'goal' | 'experience' | 'daysPerWeek' | 'sessionMinutes' | 'equipment' | 'limitations'
>;

export type PlannedDayExercise = {
  exerciseId: string;
  targetSets: number;
  repsMin: number;
  repsMax: number;
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
  name: 'Всё тело А',
  patterns: ['squat', 'horizontal_push', 'horizontal_pull', 'hinge', 'vertical_push', 'core'],
};
const fullBodyB: DayTemplate = {
  name: 'Всё тело Б',
  patterns: ['hinge', 'vertical_push', 'vertical_pull', 'lunge', 'horizontal_push', 'core'],
};
const fullBodyC: DayTemplate = {
  name: 'Всё тело В',
  patterns: ['squat', 'horizontal_pull', 'horizontal_push', 'lunge', 'biceps', 'triceps'],
};
const upperA: DayTemplate = {
  name: 'Верх тела А',
  patterns: ['horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'biceps', 'triceps'],
};
const lowerA: DayTemplate = {
  name: 'Низ тела А',
  patterns: ['squat', 'hinge', 'lunge', 'calves', 'core'],
};
const upperB: DayTemplate = {
  name: 'Верх тела Б',
  patterns: ['vertical_push', 'vertical_pull', 'horizontal_push', 'horizontal_pull', 'triceps', 'biceps'],
};
const lowerB: DayTemplate = {
  name: 'Низ тела Б',
  patterns: ['hinge', 'squat', 'lunge', 'calves', 'core'],
};
const upper: DayTemplate = { ...upperA, name: 'Верх тела' };
const lower: DayTemplate = { ...lowerA, name: 'Низ тела' };
const push: DayTemplate = {
  name: 'Жимовой день',
  patterns: ['horizontal_push', 'vertical_push', 'horizontal_push', 'vertical_push', 'triceps'],
};
const pull: DayTemplate = {
  name: 'Тяговый день',
  patterns: ['vertical_pull', 'horizontal_pull', 'hinge', 'biceps', 'core'],
};
const legs: DayTemplate = {
  name: 'День ног',
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

function repRange(exercise: Exercise, goal: Goal, experience: Experience) {
  if (exercise.isolation) {
    return isolationRange;
  }
  return goal === 'strength' && experience === 'beginner'
    ? beginnerStrengthRange
    : compoundRepRanges[goal];
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
  const { daysPerWeek, equipment, experience, goal, limitations, sessionMinutes } = profile;
  const usable = exercises.filter(
    (exercise) =>
      exercise.equipment.includes(equipment) &&
      !exercise.loads.some((area) => limitations.includes(area)) &&
      (experience !== 'beginner' || !exercise.demanding),
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
        name: `Тренировка ${index + 1}`,
        chosen: pickExercises(rotated(allPatterns, index * 3), pool, index),
      }))
    : fromTemplates;

  return days.map(({ name, chosen }) => ({
    name,
    exercises: chosen.slice(0, limit).map((exercise) => {
      const range = repRange(exercise, goal, experience);
      return {
        exerciseId: exercise.id,
        targetSets: setsByExperience[experience],
        repsMin: range.min,
        repsMax: range.max,
      };
    }),
  }));
}
