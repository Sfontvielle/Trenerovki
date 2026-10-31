import type { ActivityLevel, Baseline, Diet, Equipment, Experience, Goal, Limitation, NutritionMode, Sex } from '@/domains/profile/profile';

export const sexLabels: Record<Sex, string> = {
  male: 'Мужчина',
  female: 'Женщина',
};

export const goalLabels: Record<Goal, string> = {
  muscle: 'Набрать мышечную массу',
  fat_loss: 'Снизить долю жира',
  recomposition: 'Меньше жира, больше мышц',
  strength: 'Стать сильнее',
  maintenance: 'Поддерживать форму',
};

export const goalHints: Record<Goal, string> = {
  muscle: '8–12 повторов в основных упражнениях',
  fat_loss: '10–15 повторов. На снижение жира сильнее влияет питание',
  recomposition: '8–12 повторов в основных упражнениях',
  strength: '4–6 повторов, новичкам 8–10',
  maintenance: '8–12 повторов в основных упражнениях',
};

export const experienceLabels: Record<Experience, string> = {
  beginner: 'Новичок',
  intermediate: 'Средний',
  advanced: 'Опытный',
};

export const experienceHints: Record<Experience, string> = {
  beginner: 'До 6 месяцев',
  intermediate: 'От 6 месяцев до 2 лет',
  advanced: 'Больше 2 лет',
};

export const equipmentLabels: Record<Equipment, string> = {
  gym: 'Тренажёрный зал',
  dumbbells: 'Гантели дома',
  bar: 'Свой вес и турник',
  bodyweight: 'Только свой вес',
};

export const equipmentHints: Record<Equipment, string> = {
  gym: 'Штанга, блоки и тренажёры',
  dumbbells: 'Скамья не обязательна, нужна устойчивая опора',
  bar: 'На площадке или с закреплённой низкой перекладиной',
  bodyweight: 'Без инвентаря',
};

export const activityLabels: Record<ActivityLevel, string> = {
  sedentary: 'В основном сижу',
  light: 'Немного двигаюсь',
  moderate: 'Много хожу',
  active: 'Физическая работа',
};

export const activityHints: Record<ActivityLevel, string> = {
  sedentary: 'Офис, учёба, мало ходьбы',
  light: 'Прогулки и домашние дела',
  moderate: 'На ногах большую часть дня',
  active: 'Тяжёлая работа или много спорта вне плана',
};

export const baselineLabels: Record<Baseline, string> = {
  low: 'Пока ни одного или пару',
  medium: 'Примерно до 15',
  high: 'Больше 15',
};

export const sleepChoices = [
  { hours: 5.5, label: 'Меньше 6 часов' },
  { hours: 6.5, label: '6–7 часов' },
  { hours: 7.5, label: '7–8 часов' },
  { hours: 8.5, label: 'Больше 8 часов' },
];

export const nutritionModeLabels: Record<NutritionMode, string> = {
  targets: 'Считать калории и БЖУ',
  protein: 'Следить только за белком',
  diary: 'Только дневник, без целей',
};

export const dietLabels: Record<Diet, string> = {
  any: 'Без ограничений',
  vegetarian: 'Вегетарианское',
  vegan: 'Веганское',
};

export const limitationLabels: Record<Limitation, string> = {
  shoulders: 'Плечи',
  elbows: 'Локти',
  wrists: 'Запястья',
  neck: 'Шея',
  lower_back: 'Поясница',
  hips: 'Тазобедренные суставы',
  knees: 'Колени',
  ankles: 'Голеностопы',
};
