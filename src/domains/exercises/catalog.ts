import type { Equipment, Limitation } from '../profile/profile';

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'biceps'
  | 'triceps'
  | 'calves'
  | 'core';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';

export type Exercise = {
  id: string;
  name: string;
  pattern: MovementPattern;
  muscleGroup: MuscleGroup;
  equipment: Equipment[];
  loads: Limitation[];
  // Technically demanding lifts are left out of beginner plans.
  demanding: boolean;
  isolation: boolean;
};

const anywhere: Equipment[] = ['gym', 'dumbbells', 'bar', 'bodyweight'];
const withWeights: Equipment[] = ['gym', 'dumbbells'];

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  arms: 'Руки',
  legs: 'Ноги',
  core: 'Мышцы корпуса',
};

export const exercises: Exercise[] = [
  { id: 'machine-chest-press', name: 'Жим от груди в тренажёре', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'], demanding: false, isolation: false },
  { id: 'bench-press', name: 'Жим штанги лёжа', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'], demanding: true, isolation: false },
  { id: 'incline-dumbbell-press', name: 'Жим гантелей на наклонной скамье', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'], demanding: true, isolation: false },
  { id: 'floor-dumbbell-press', name: 'Жим гантелей лёжа на полу', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['dumbbells'], loads: ['shoulders'], demanding: false, isolation: false },
  { id: 'push-up', name: 'Отжимания', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: anywhere, loads: ['shoulders'], demanding: false, isolation: false },
  { id: 'dumbbell-shoulder-press', name: 'Жим гантелей сидя', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: withWeights, loads: ['shoulders'], demanding: false, isolation: false },
  { id: 'overhead-press', name: 'Жим штанги стоя', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: ['gym'], loads: ['shoulders', 'lower_back'], demanding: true, isolation: false },
  { id: 'pike-push-up', name: 'Отжимания с поднятым тазом', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: ['bar', 'bodyweight'], loads: ['shoulders'], demanding: true, isolation: false },
  { id: 'lateral-raise', name: 'Махи гантелями в стороны', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: withWeights, loads: ['shoulders'], demanding: false, isolation: true },
  { id: 'chest-supported-row', name: 'Тяга в тренажёре с упором грудью', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['gym'], loads: [], demanding: false, isolation: false },
  { id: 'seated-cable-row', name: 'Тяга горизонтального блока', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['gym'], loads: ['lower_back'], demanding: false, isolation: false },
  { id: 'dumbbell-row', name: 'Тяга гантели в наклоне', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: withWeights, loads: ['lower_back'], demanding: false, isolation: false },
  { id: 'inverted-row', name: 'Австралийские подтягивания', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['bar'], loads: [], demanding: false, isolation: false },
  { id: 'superman', name: 'Супермен лёжа на полу', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['bodyweight'], loads: ['lower_back'], demanding: false, isolation: true },
  { id: 'lat-pulldown', name: 'Тяга верхнего блока', pattern: 'vertical_pull', muscleGroup: 'back', equipment: ['gym'], loads: ['shoulders'], demanding: false, isolation: false },
  { id: 'pull-up', name: 'Подтягивания', pattern: 'vertical_pull', muscleGroup: 'back', equipment: ['gym', 'bar'], loads: ['shoulders'], demanding: true, isolation: false },
  { id: 'leg-press', name: 'Жим ногами', pattern: 'squat', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees', 'lower_back'], demanding: false, isolation: false },
  { id: 'back-squat', name: 'Приседания со штангой', pattern: 'squat', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees', 'lower_back'], demanding: true, isolation: false },
  { id: 'goblet-squat', name: 'Приседания с гантелью', pattern: 'squat', muscleGroup: 'legs', equipment: withWeights, loads: ['knees'], demanding: false, isolation: false },
  { id: 'bodyweight-squat', name: 'Приседания', pattern: 'squat', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'], demanding: false, isolation: false },
  { id: 'dumbbell-romanian-deadlift', name: 'Румынская тяга с гантелями', pattern: 'hinge', muscleGroup: 'legs', equipment: withWeights, loads: ['lower_back'], demanding: false, isolation: false },
  { id: 'romanian-deadlift', name: 'Румынская тяга', pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: ['lower_back'], demanding: true, isolation: false },
  { id: 'leg-curl', name: 'Сгибание ног в тренажёре', pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees'], demanding: false, isolation: true },
  { id: 'glute-bridge', name: 'Ягодичный мост', pattern: 'hinge', muscleGroup: 'legs', equipment: anywhere, loads: [], demanding: false, isolation: true },
  { id: 'walking-lunge', name: 'Выпады', pattern: 'lunge', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'], demanding: false, isolation: false },
  { id: 'leg-extension', name: 'Разгибание ног в тренажёре', pattern: 'lunge', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees'], demanding: false, isolation: true },
  { id: 'barbell-curl', name: 'Сгибания рук со штангой', pattern: 'biceps', muscleGroup: 'arms', equipment: ['gym'], loads: [], demanding: false, isolation: true },
  { id: 'dumbbell-curl', name: 'Сгибания рук с гантелями', pattern: 'biceps', muscleGroup: 'arms', equipment: withWeights, loads: [], demanding: false, isolation: true },
  { id: 'triceps-pushdown', name: 'Разгибания рук на блоке', pattern: 'triceps', muscleGroup: 'arms', equipment: ['gym'], loads: [], demanding: false, isolation: true },
  { id: 'dumbbell-overhead-extension', name: 'Французский жим с гантелью', pattern: 'triceps', muscleGroup: 'arms', equipment: withWeights, loads: ['shoulders'], demanding: false, isolation: true },
  { id: 'calf-raise', name: 'Подъёмы на носки', pattern: 'calves', muscleGroup: 'legs', equipment: anywhere, loads: [], demanding: false, isolation: true },
  { id: 'crunch', name: 'Скручивания', pattern: 'core', muscleGroup: 'core', equipment: anywhere, loads: ['lower_back'], demanding: false, isolation: true },
  { id: 'dead-bug', name: 'Мёртвый жук', pattern: 'core', muscleGroup: 'core', equipment: anywhere, loads: [], demanding: false, isolation: true },
];

const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

export function findExercise(exerciseId: string) {
  return exercisesById.get(exerciseId) ?? null;
}

export function exerciseName(exerciseId: string) {
  return findExercise(exerciseId)?.name ?? 'Неизвестное упражнение';
}
