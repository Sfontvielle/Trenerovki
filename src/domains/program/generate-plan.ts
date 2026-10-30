import { type MovementPattern, exercises } from '../exercises/catalog';
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
  5: [upperA, lowerA, push, pull, legs],
};

const repRanges: Record<Goal, { min: number; max: number }> = {
  strength: { min: 4, max: 6 },
  muscle: { min: 8, max: 12 },
  recomposition: { min: 8, max: 12 },
  fat_loss: { min: 10, max: 15 },
  maintenance: { min: 8, max: 12 },
};

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

export function generatePlan(profile: PlanProfile): PlannedDay[] {
  const available = exercises.filter(
    (exercise) =>
      exercise.equipment.includes(profile.equipment) &&
      !exercise.loads.some((area) => profile.limitations.includes(area)),
  );
  const range = repRanges[profile.goal];

  const days = splits[profile.daysPerWeek].map((template, dayIndex) => {
    const chosen = new Set<string>();

    for (const pattern of template.patterns) {
      const candidates = available.filter(
        (exercise) => exercise.pattern === pattern && !chosen.has(exercise.id),
      );
      if (candidates.length > 0) {
        chosen.add(candidates[dayIndex % candidates.length].id);
      }
    }

    return {
      name: template.name,
      exercises: [...chosen].slice(0, exercisesPerSession[profile.sessionMinutes]).map((exerciseId) => ({
        exerciseId,
        targetSets: setsByExperience[profile.experience],
        repsMin: range.min,
        repsMax: range.max,
      })),
    };
  });

  return days.filter((day) => day.exercises.length > 0);
}
