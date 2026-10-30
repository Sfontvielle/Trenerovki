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
};

const anywhere: Equipment[] = ['gym', 'dumbbells', 'bodyweight'];
const withWeights: Equipment[] = ['gym', 'dumbbells'];

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: 'Грудь',
  back: 'Спина',
  shoulders: 'Плечи',
  arms: 'Руки',
  legs: 'Ноги',
  core: 'Кор',
};

export const exercises: Exercise[] = [
  { id: 'bench-press', name: 'Жим штанги лёжа', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'] },
  { id: 'incline-dumbbell-press', name: 'Жим гантелей на наклонной скамье', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: withWeights, loads: ['shoulders'] },
  { id: 'machine-chest-press', name: 'Жим от груди в тренажёре', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'] },
  { id: 'push-up', name: 'Отжимания', pattern: 'horizontal_push', muscleGroup: 'chest', equipment: anywhere, loads: ['shoulders'] },
  { id: 'overhead-press', name: 'Жим штанги стоя', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: ['gym'], loads: ['shoulders', 'lower_back'] },
  { id: 'dumbbell-shoulder-press', name: 'Жим гантелей сидя', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: withWeights, loads: ['shoulders'] },
  { id: 'pike-push-up', name: 'Отжимания с поднятым тазом', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: ['bodyweight'], loads: ['shoulders'] },
  { id: 'lateral-raise', name: 'Махи гантелями в стороны', pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: withWeights, loads: ['shoulders'] },
  { id: 'seated-cable-row', name: 'Тяга горизонтального блока', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['gym'], loads: [] },
  { id: 'dumbbell-row', name: 'Тяга гантели в наклоне', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: withWeights, loads: ['lower_back'] },
  { id: 'inverted-row', name: 'Австралийские подтягивания', pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['bodyweight'], loads: [] },
  { id: 'lat-pulldown', name: 'Тяга верхнего блока', pattern: 'vertical_pull', muscleGroup: 'back', equipment: ['gym'], loads: [] },
  { id: 'pull-up', name: 'Подтягивания', pattern: 'vertical_pull', muscleGroup: 'back', equipment: ['gym', 'bodyweight'], loads: ['shoulders'] },
  { id: 'back-squat', name: 'Приседания со штангой', pattern: 'squat', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees', 'lower_back'] },
  { id: 'leg-press', name: 'Жим ногами', pattern: 'squat', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees'] },
  { id: 'goblet-squat', name: 'Приседания с гантелью', pattern: 'squat', muscleGroup: 'legs', equipment: withWeights, loads: ['knees'] },
  { id: 'bodyweight-squat', name: 'Приседания', pattern: 'squat', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'] },
  { id: 'romanian-deadlift', name: 'Румынская тяга', pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: ['lower_back'] },
  { id: 'dumbbell-romanian-deadlift', name: 'Румынская тяга с гантелями', pattern: 'hinge', muscleGroup: 'legs', equipment: withWeights, loads: ['lower_back'] },
  { id: 'leg-curl', name: 'Сгибание ног в тренажёре', pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: [] },
  { id: 'glute-bridge', name: 'Ягодичный мост', pattern: 'hinge', muscleGroup: 'legs', equipment: anywhere, loads: [] },
  { id: 'walking-lunge', name: 'Выпады', pattern: 'lunge', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'] },
  { id: 'leg-extension', name: 'Разгибание ног в тренажёре', pattern: 'lunge', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees'] },
  { id: 'barbell-curl', name: 'Сгибания рук со штангой', pattern: 'biceps', muscleGroup: 'arms', equipment: ['gym'], loads: [] },
  { id: 'dumbbell-curl', name: 'Сгибания рук с гантелями', pattern: 'biceps', muscleGroup: 'arms', equipment: withWeights, loads: [] },
  { id: 'triceps-pushdown', name: 'Разгибания рук на блоке', pattern: 'triceps', muscleGroup: 'arms', equipment: ['gym'], loads: [] },
  { id: 'dumbbell-overhead-extension', name: 'Французский жим с гантелью', pattern: 'triceps', muscleGroup: 'arms', equipment: withWeights, loads: ['shoulders'] },
  { id: 'calf-raise', name: 'Подъёмы на носки', pattern: 'calves', muscleGroup: 'legs', equipment: anywhere, loads: [] },
  { id: 'crunch', name: 'Скручивания', pattern: 'core', muscleGroup: 'core', equipment: anywhere, loads: [] },
  { id: 'dead-bug', name: 'Мёртвый жук', pattern: 'core', muscleGroup: 'core', equipment: anywhere, loads: [] },
];

const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));

export function exerciseName(exerciseId: string) {
  return exercisesById.get(exerciseId)?.name ?? 'Неизвестное упражнение';
}
