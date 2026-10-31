import type { Equipment, Limitation } from '../profile/profile';
import { t } from '@/lib/i18n';

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
  | 'core'
  | 'chest_fly'
  | 'rear_delt'
  | 'carry'
  | 'conditioning'
  | 'cardio'
  | 'mobility';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full_body';

export type Muscle =
  | 'chest'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'traps'
  | 'lats'
  | 'upper_back'
  | 'lower_back'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'glutes'
  | 'quads'
  | 'hamstrings'
  | 'calves';

export type ExerciseCategory = 'strength' | 'functional' | 'cardio' | 'mobility';
export type Tracking = 'reps' | 'duration' | 'cardio';

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
  category: ExerciseCategory;
  tracking: Tracking;
  primary: Muscle[];
  secondary: Muscle[];
};

type Seed = Omit<Exercise, 'category' | 'tracking' | 'demanding' | 'isolation' | 'loads' | 'secondary'> &
  Partial<Pick<Exercise, 'tracking' | 'demanding' | 'isolation' | 'loads' | 'secondary'>>;

const anywhere: Equipment[] = ['gym', 'dumbbells', 'bar', 'bodyweight'];
const withWeights: Equipment[] = ['gym', 'dumbbells'];

function seed(category: ExerciseCategory, tracking: Tracking, exercise: Seed): Exercise {
  return { demanding: false, isolation: false, loads: [], secondary: [], category, tracking, ...exercise };
}

const strength = (exercise: Seed) => seed('strength', 'reps', exercise);
const functional = (exercise: Seed) => seed('functional', 'reps', exercise);
const cardio = (exercise: Seed) => seed('cardio', 'cardio', exercise);
const mobility = (exercise: Seed) => seed('mobility', 'duration', exercise);

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: t('Грудь'),
  back: t('Спина'),
  shoulders: t('Плечи'),
  arms: t('Руки'),
  legs: t('Ноги'),
  core: t('Мышцы корпуса'),
  full_body: t('Всё тело'),
};

export const muscleLabels: Record<Muscle, string> = {
  chest: t('Грудные'),
  front_delts: t('Передняя дельта'),
  side_delts: t('Средняя дельта'),
  rear_delts: t('Задняя дельта'),
  traps: t('Трапеции'),
  lats: t('Широчайшие'),
  upper_back: t('Верх спины'),
  lower_back: t('Разгибатели спины'),
  biceps: t('Бицепс'),
  triceps: t('Трицепс'),
  forearms: t('Предплечья'),
  abs: t('Пресс'),
  obliques: t('Косые мышцы живота'),
  glutes: t('Ягодичные'),
  quads: t('Передняя поверхность бедра'),
  hamstrings: t('Задняя поверхность бедра'),
  calves: t('Икроножные'),
};

export const categoryLabels: Record<ExerciseCategory, string> = {
  strength: t('Силовые'),
  functional: t('Функциональные'),
  cardio: t('Кардио'),
  mobility: t('Мобильность'),
};

export const exercises: Exercise[] = [
  strength({ id: 'machine-chest-press', name: t('Жим от груди в тренажёре'), pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'], primary: ['chest'], secondary: ['front_delts', 'triceps'] }),
  strength({ id: 'bench-press', name: t('Жим штанги лёжа'), pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders', 'elbows', 'wrists'], demanding: true, primary: ['chest'], secondary: ['front_delts', 'triceps'] }),
  strength({ id: 'incline-dumbbell-press', name: t('Жим гантелей на наклонной скамье'), pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'], demanding: true, primary: ['chest'], secondary: ['front_delts', 'triceps'] }),
  strength({ id: 'floor-dumbbell-press', name: t('Жим гантелей лёжа на полу'), pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['dumbbells'], loads: ['shoulders'], primary: ['chest'], secondary: ['triceps'] }),
  strength({ id: 'push-up', name: t('Отжимания'), pattern: 'horizontal_push', muscleGroup: 'chest', equipment: anywhere, loads: ['shoulders', 'wrists'], primary: ['chest'], secondary: ['front_delts', 'triceps', 'abs'] }),
  strength({ id: 'dumbbell-shoulder-press', name: t('Жим гантелей сидя'), pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: withWeights, loads: ['shoulders'], primary: ['front_delts', 'side_delts'], secondary: ['triceps'] }),
  strength({ id: 'overhead-press', name: t('Жим штанги стоя'), pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: ['gym'], loads: ['shoulders', 'lower_back'], demanding: true, primary: ['front_delts', 'side_delts'], secondary: ['triceps', 'traps', 'abs'] }),
  strength({ id: 'pike-push-up', name: t('Отжимания с поднятым тазом'), pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: ['bar', 'bodyweight'], loads: ['shoulders', 'wrists'], demanding: true, primary: ['front_delts'], secondary: ['triceps', 'side_delts'] }),
  strength({ id: 'lateral-raise', name: t('Махи гантелями в стороны'), pattern: 'vertical_push', muscleGroup: 'shoulders', equipment: withWeights, loads: ['shoulders'], isolation: true, primary: ['side_delts'], secondary: ['traps'] }),
  strength({ id: 'chest-supported-row', name: t('Тяга в тренажёре с упором грудью'), pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['gym'], primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'] }),
  strength({ id: 'seated-cable-row', name: t('Тяга горизонтального блока'), pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['gym'], loads: ['lower_back'], primary: ['upper_back', 'lats'], secondary: ['biceps', 'forearms'] }),
  strength({ id: 'dumbbell-row', name: t('Тяга гантели в наклоне'), pattern: 'horizontal_pull', muscleGroup: 'back', equipment: withWeights, loads: ['lower_back'], primary: ['lats', 'upper_back'], secondary: ['biceps', 'forearms'] }),
  strength({ id: 'inverted-row', name: t('Австралийские подтягивания'), pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['bar'], primary: ['upper_back', 'lats'], secondary: ['biceps', 'rear_delts'] }),
  strength({ id: 'superman', name: t('Супермен лёжа на полу'), pattern: 'horizontal_pull', muscleGroup: 'back', equipment: ['bodyweight'], loads: ['lower_back'], isolation: true, primary: ['lower_back'], secondary: ['glutes'] }),
  strength({ id: 'lat-pulldown', name: t('Тяга верхнего блока'), pattern: 'vertical_pull', muscleGroup: 'back', equipment: ['gym'], loads: ['shoulders'], primary: ['lats'], secondary: ['biceps', 'upper_back'] }),
  strength({ id: 'pull-up', name: t('Подтягивания'), pattern: 'vertical_pull', muscleGroup: 'back', equipment: ['gym', 'bar'], loads: ['shoulders', 'elbows'], demanding: true, primary: ['lats'], secondary: ['biceps', 'upper_back', 'forearms'] }),
  strength({ id: 'leg-press', name: t('Жим ногами'), pattern: 'squat', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees', 'lower_back'], primary: ['quads', 'glutes'], secondary: ['hamstrings'] }),
  strength({ id: 'back-squat', name: t('Приседания со штангой'), pattern: 'squat', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees', 'lower_back', 'hips'], demanding: true, primary: ['quads', 'glutes'], secondary: ['hamstrings', 'lower_back', 'abs'] }),
  strength({ id: 'goblet-squat', name: t('Приседания с гантелью'), pattern: 'squat', muscleGroup: 'legs', equipment: withWeights, loads: ['knees'], primary: ['quads', 'glutes'], secondary: ['abs'] }),
  strength({ id: 'bodyweight-squat', name: t('Приседания'), pattern: 'squat', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'], primary: ['quads', 'glutes'], secondary: ['hamstrings'] }),
  strength({ id: 'dumbbell-romanian-deadlift', name: t('Румынская тяга с гантелями'), pattern: 'hinge', muscleGroup: 'legs', equipment: withWeights, loads: ['lower_back'], primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'forearms'] }),
  strength({ id: 'romanian-deadlift', name: t('Румынская тяга'), pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: ['lower_back'], demanding: true, primary: ['hamstrings', 'glutes'], secondary: ['lower_back', 'forearms'] }),
  strength({ id: 'leg-curl', name: t('Сгибание ног в тренажёре'), pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees'], isolation: true, primary: ['hamstrings'], secondary: ['calves'] }),
  strength({ id: 'glute-bridge', name: t('Ягодичный мост'), pattern: 'hinge', muscleGroup: 'legs', equipment: anywhere, isolation: true, primary: ['glutes'], secondary: ['hamstrings'] }),
  strength({ id: 'walking-lunge', name: t('Выпады'), pattern: 'lunge', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'], primary: ['quads', 'glutes'], secondary: ['hamstrings'] }),
  strength({ id: 'leg-extension', name: t('Разгибание ног в тренажёре'), pattern: 'lunge', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees'], isolation: true, primary: ['quads'] }),
  strength({ id: 'barbell-curl', name: t('Сгибания рук со штангой'), pattern: 'biceps', muscleGroup: 'arms', equipment: ['gym'], loads: ['elbows', 'wrists'], isolation: true, primary: ['biceps'], secondary: ['forearms'] }),
  strength({ id: 'dumbbell-curl', name: t('Сгибания рук с гантелями'), pattern: 'biceps', muscleGroup: 'arms', equipment: withWeights, loads: ['elbows'], isolation: true, primary: ['biceps'], secondary: ['forearms'] }),
  strength({ id: 'triceps-pushdown', name: t('Разгибания рук на блоке'), pattern: 'triceps', muscleGroup: 'arms', equipment: ['gym'], loads: ['elbows'], isolation: true, primary: ['triceps'] }),
  strength({ id: 'dumbbell-overhead-extension', name: t('Французский жим с гантелью'), pattern: 'triceps', muscleGroup: 'arms', equipment: withWeights, loads: ['shoulders', 'elbows'], isolation: true, primary: ['triceps'] }),
  strength({ id: 'calf-raise', name: t('Подъёмы на носки'), pattern: 'calves', muscleGroup: 'legs', equipment: anywhere, loads: ['ankles'], isolation: true, primary: ['calves'] }),
  strength({ id: 'crunch', name: t('Скручивания'), pattern: 'core', muscleGroup: 'core', equipment: anywhere, loads: ['lower_back', 'neck'], isolation: true, primary: ['abs'], secondary: ['obliques'] }),
  strength({ id: 'dead-bug', name: t('Мёртвый жук'), pattern: 'core', muscleGroup: 'core', equipment: anywhere, isolation: true, primary: ['abs'], secondary: ['obliques'] }),

  strength({ id: 'incline-push-up', name: t('Отжимания с опорой на возвышение'), pattern: 'horizontal_push', muscleGroup: 'chest', equipment: anywhere, loads: ['shoulders', 'wrists'], primary: ['chest'], secondary: ['front_delts', 'triceps'] }),
  strength({ id: 'dip', name: t('Отжимания на брусьях'), pattern: 'horizontal_push', muscleGroup: 'chest', equipment: ['gym', 'bar'], loads: ['shoulders', 'elbows'], demanding: true, primary: ['chest', 'triceps'], secondary: ['front_delts'] }),
  strength({ id: 'cable-fly', name: t('Сведение рук на блоке'), pattern: 'chest_fly', muscleGroup: 'chest', equipment: ['gym'], loads: ['shoulders'], isolation: true, primary: ['chest'], secondary: ['front_delts'] }),
  strength({ id: 'reverse-fly', name: t('Разведения гантелей в наклоне'), pattern: 'rear_delt', muscleGroup: 'shoulders', equipment: withWeights, loads: ['lower_back'], isolation: true, primary: ['rear_delts'], secondary: ['upper_back'] }),
  strength({ id: 'face-pull', name: t('Тяга каната к лицу'), pattern: 'rear_delt', muscleGroup: 'shoulders', equipment: ['gym'], isolation: true, primary: ['rear_delts'], secondary: ['traps', 'upper_back'] }),
  strength({ id: 'assisted-pull-up', name: t('Подтягивания в гравитроне'), pattern: 'vertical_pull', muscleGroup: 'back', equipment: ['gym'], loads: ['shoulders', 'elbows'], primary: ['lats'], secondary: ['biceps', 'upper_back'] }),
  strength({ id: 'deadlift', name: t('Становая тяга'), pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: ['lower_back', 'hips'], demanding: true, primary: ['glutes', 'hamstrings', 'lower_back'], secondary: ['traps', 'forearms', 'quads'] }),
  strength({ id: 'hip-thrust', name: t('Ягодичный мост со штангой'), pattern: 'hinge', muscleGroup: 'legs', equipment: ['gym'], loads: ['hips'], demanding: true, primary: ['glutes'], secondary: ['hamstrings'] }),
  strength({ id: 'split-squat', name: t('Сплит-приседания'), pattern: 'lunge', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'], primary: ['quads', 'glutes'], secondary: ['hamstrings'] }),
  strength({ id: 'step-up', name: t('Зашагивания на опору'), pattern: 'lunge', muscleGroup: 'legs', equipment: anywhere, loads: ['knees', 'ankles'], primary: ['quads', 'glutes'], secondary: ['calves'] }),
  strength({ id: 'hammer-curl', name: t('Молотковые сгибания'), pattern: 'biceps', muscleGroup: 'arms', equipment: withWeights, loads: ['elbows'], isolation: true, primary: ['biceps', 'forearms'] }),
  strength({ id: 'close-push-up', name: t('Отжимания узким упором'), pattern: 'triceps', muscleGroup: 'arms', equipment: anywhere, loads: ['elbows', 'wrists', 'shoulders'], primary: ['triceps'], secondary: ['chest', 'front_delts'] }),
  strength({ id: 'plank', name: t('Планка'), pattern: 'core', muscleGroup: 'core', equipment: anywhere, tracking: 'duration', loads: ['shoulders', 'lower_back'], isolation: true, primary: ['abs'], secondary: ['obliques', 'front_delts'] }),
  strength({ id: 'side-plank', name: t('Боковая планка'), pattern: 'core', muscleGroup: 'core', equipment: anywhere, tracking: 'duration', loads: ['shoulders'], isolation: true, primary: ['obliques'], secondary: ['abs', 'side_delts'] }),
  strength({ id: 'bird-dog', name: t('Птица-собака'), pattern: 'core', muscleGroup: 'core', equipment: anywhere, isolation: true, primary: ['lower_back', 'abs'], secondary: ['glutes'] }),
  strength({ id: 'hanging-knee-raise', name: t('Подъём коленей в висе'), pattern: 'core', muscleGroup: 'core', equipment: ['gym', 'bar'], loads: ['shoulders'], demanding: true, isolation: true, primary: ['abs'], secondary: ['forearms'] }),

  functional({ id: 'farmer-walk', name: t('Прогулка фермера'), pattern: 'carry', muscleGroup: 'full_body', equipment: withWeights, tracking: 'duration', primary: ['forearms', 'traps'], secondary: ['abs', 'glutes'] }),
  functional({ id: 'kettlebell-swing', name: t('Махи гирей'), pattern: 'conditioning', muscleGroup: 'full_body', equipment: withWeights, loads: ['lower_back'], demanding: true, primary: ['glutes', 'hamstrings'], secondary: ['lower_back', 'abs', 'forearms'] }),
  functional({ id: 'dumbbell-thruster', name: t('Трастеры с гантелями'), pattern: 'conditioning', muscleGroup: 'full_body', equipment: withWeights, loads: ['shoulders', 'knees'], demanding: true, primary: ['quads', 'front_delts'], secondary: ['glutes', 'triceps'] }),
  functional({ id: 'burpee', name: t('Бёрпи'), pattern: 'conditioning', muscleGroup: 'full_body', equipment: anywhere, loads: ['shoulders', 'knees', 'lower_back', 'wrists'], demanding: true, primary: ['chest', 'quads'], secondary: ['abs', 'front_delts', 'calves'] }),
  functional({ id: 'jump-squat', name: t('Прыжки из приседа'), pattern: 'conditioning', muscleGroup: 'legs', equipment: anywhere, loads: ['knees', 'ankles', 'hips'], demanding: true, primary: ['quads', 'glutes'], secondary: ['calves'] }),
  functional({ id: 'mountain-climber', name: t('Скалолаз'), pattern: 'conditioning', muscleGroup: 'full_body', equipment: anywhere, tracking: 'duration', loads: ['shoulders', 'wrists'], primary: ['abs'], secondary: ['front_delts', 'quads'] }),
  functional({ id: 'bear-crawl', name: t('Медвежья походка'), pattern: 'conditioning', muscleGroup: 'full_body', equipment: anywhere, tracking: 'duration', loads: ['shoulders', 'wrists'], primary: ['abs', 'front_delts'], secondary: ['quads'] }),

  cardio({ id: 'walking', name: t('Ходьба'), pattern: 'cardio', muscleGroup: 'full_body', equipment: anywhere, primary: ['calves', 'glutes'], secondary: ['quads'] }),
  cardio({ id: 'running', name: t('Бег'), pattern: 'cardio', muscleGroup: 'full_body', equipment: anywhere, loads: ['knees', 'ankles', 'hips'], primary: ['quads', 'calves'], secondary: ['glutes', 'hamstrings'] }),
  cardio({ id: 'treadmill', name: t('Беговая дорожка'), pattern: 'cardio', muscleGroup: 'full_body', equipment: ['gym'], loads: ['knees', 'ankles'], primary: ['quads', 'calves'], secondary: ['glutes'] }),
  cardio({ id: 'cycling', name: t('Велосипед'), pattern: 'cardio', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'], primary: ['quads'], secondary: ['glutes', 'calves'] }),
  cardio({ id: 'stationary-bike', name: t('Велотренажёр'), pattern: 'cardio', muscleGroup: 'legs', equipment: ['gym'], loads: ['knees'], primary: ['quads'], secondary: ['glutes', 'calves'] }),
  cardio({ id: 'elliptical', name: t('Эллиптический тренажёр'), pattern: 'cardio', muscleGroup: 'full_body', equipment: ['gym'], primary: ['quads', 'glutes'], secondary: ['calves'] }),
  cardio({ id: 'rowing-machine', name: t('Гребной тренажёр'), pattern: 'cardio', muscleGroup: 'full_body', equipment: ['gym'], loads: ['lower_back'], primary: ['upper_back', 'quads'], secondary: ['biceps', 'glutes'] }),
  cardio({ id: 'stair-climber', name: t('Лестница'), pattern: 'cardio', muscleGroup: 'legs', equipment: anywhere, loads: ['knees', 'ankles'], primary: ['glutes', 'quads'], secondary: ['calves'] }),
  cardio({ id: 'jump-rope', name: t('Скакалка'), pattern: 'cardio', muscleGroup: 'full_body', equipment: anywhere, loads: ['knees', 'ankles'], demanding: true, primary: ['calves'], secondary: ['quads', 'forearms'] }),
  cardio({ id: 'swimming', name: t('Плавание'), pattern: 'cardio', muscleGroup: 'full_body', equipment: anywhere, loads: ['shoulders'], primary: ['lats', 'front_delts'], secondary: ['abs', 'quads'] }),

  mobility({ id: 'cat-cow', name: t('Кошка-корова'), pattern: 'mobility', muscleGroup: 'back', equipment: anywhere, primary: ['lower_back'], secondary: ['abs'] }),
  mobility({ id: 'childs-pose', name: t('Поза ребёнка'), pattern: 'mobility', muscleGroup: 'back', equipment: anywhere, loads: ['knees'], primary: ['lats', 'lower_back'] }),
  mobility({ id: 'thoracic-rotation', name: t('Вращения грудного отдела'), pattern: 'mobility', muscleGroup: 'back', equipment: anywhere, primary: ['upper_back'], secondary: ['obliques'] }),
  mobility({ id: 'hip-flexor-stretch', name: t('Растяжка сгибателей бедра'), pattern: 'mobility', muscleGroup: 'legs', equipment: anywhere, loads: ['knees'], primary: ['quads'], secondary: ['glutes'] }),
  mobility({ id: 'hamstring-stretch', name: t('Растяжка задней поверхности бедра'), pattern: 'mobility', muscleGroup: 'legs', equipment: anywhere, primary: ['hamstrings'] }),
  mobility({ id: 'figure-four-stretch', name: t('Растяжка ягодичных лёжа'), pattern: 'mobility', muscleGroup: 'legs', equipment: anywhere, primary: ['glutes'] }),
  mobility({ id: 'chest-doorway-stretch', name: t('Растяжка груди в дверном проёме'), pattern: 'mobility', muscleGroup: 'chest', equipment: anywhere, loads: ['shoulders'], primary: ['chest'], secondary: ['front_delts'] }),
  mobility({ id: 'wall-slide', name: t('Скольжение руками по стене'), pattern: 'mobility', muscleGroup: 'shoulders', equipment: anywhere, primary: ['traps', 'rear_delts'] }),
  mobility({ id: 'ankle-rock', name: t('Покачивания на голеностопе'), pattern: 'mobility', muscleGroup: 'legs', equipment: anywhere, primary: ['calves'] }),
  mobility({ id: 'lunge-rotation', name: t('Выпад с поворотом корпуса'), pattern: 'mobility', muscleGroup: 'full_body', equipment: anywhere, loads: ['knees'], primary: ['glutes', 'quads'], secondary: ['upper_back', 'obliques'] }),
];

export type CustomExerciseInfo = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup;
  tracking: Tracking;
  equipment: Equipment[];
};

const exercisesById = new Map(exercises.map((exercise) => [exercise.id, exercise]));
const customExercises = new Map<string, CustomExerciseInfo>();

export function registerCustomExercises(entries: CustomExerciseInfo[]) {
  customExercises.clear();
  for (const entry of entries) {
    customExercises.set(entry.id, entry);
  }
}

export function findExercise(exerciseId: string) {
  return exercisesById.get(exerciseId) ?? null;
}

export function exerciseName(exerciseId: string) {
  return findExercise(exerciseId)?.name ?? customExercises.get(exerciseId)?.name ?? t('Неизвестное упражнение');
}

export function exerciseTracking(exerciseId: string): Tracking {
  return findExercise(exerciseId)?.tracking ?? customExercises.get(exerciseId)?.tracking ?? 'reps';
}

type AlternativeFilter = {
  equipment: Equipment;
  limitations: Limitation[];
  excluded?: string[];
  count?: number;
};

// Same movement first, then anything that trains the same main muscles.
export function findAlternatives(
  exerciseId: string,
  { equipment, limitations, excluded = [], count = 5 }: AlternativeFilter,
) {
  const source = findExercise(exerciseId);
  if (!source) {
    return [];
  }
  const allowed = exercises.filter(
    (exercise) =>
      exercise.id !== exerciseId &&
      !excluded.includes(exercise.id) &&
      exercise.equipment.includes(equipment) &&
      !exercise.loads.some((area) => limitations.includes(area)),
  );
  const samePattern = allowed.filter((exercise) => exercise.pattern === source.pattern);
  const sameMuscle = allowed.filter(
    (exercise) =>
      exercise.pattern !== source.pattern &&
      exercise.category === source.category &&
      exercise.primary.some((muscle) => source.primary.includes(muscle)),
  );
  return [...samePattern, ...sameMuscle].slice(0, count);
}
