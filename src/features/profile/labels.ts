import type { ActivityLevel, Baseline, Diet, Equipment, Experience, Goal, Limitation, NutritionMode, Sex } from '@/domains/profile/profile';
import { t } from '@/lib/i18n';

export const sexLabels: Record<Sex, string> = {
  male: t('Мужчина'),
  female: t('Женщина'),
};

export const goalLabels: Record<Goal, string> = {
  muscle: t('Набрать мышечную массу'),
  fat_loss: t('Снизить долю жира'),
  recomposition: t('Меньше жира, больше мышц'),
  strength: t('Стать сильнее'),
  maintenance: t('Поддерживать форму'),
};

export const goalHints: Record<Goal, string> = {
  muscle: t('8–12 повторов в основных упражнениях'),
  fat_loss: t('10–15 повторов. На снижение жира сильнее влияет питание'),
  recomposition: t('8–12 повторов в основных упражнениях'),
  strength: t('4–6 повторов, новичкам 8–10'),
  maintenance: t('8–12 повторов в основных упражнениях'),
};

export const experienceLabels: Record<Experience, string> = {
  beginner: t('Новичок'),
  intermediate: t('Средний'),
  advanced: t('Продвинутый'),
};

export const experienceHints: Record<Experience, string> = {
  beginner: t('До 6 месяцев'),
  intermediate: t('От 6 месяцев до 2 лет'),
  advanced: t('Больше 2 лет'),
};

export const equipmentLabels: Record<Equipment, string> = {
  gym: t('Тренажёрный зал'),
  dumbbells: t('Гантели дома'),
  bar: t('Свой вес и турник'),
  bodyweight: t('Только свой вес'),
};

export const equipmentHints: Record<Equipment, string> = {
  gym: t('Штанга, блоки и тренажёры'),
  dumbbells: t('Скамья не обязательна, нужна устойчивая опора'),
  bar: t('На площадке или с закреплённой низкой перекладиной'),
  bodyweight: t('Без инвентаря'),
};

export const activityLabels: Record<ActivityLevel, string> = {
  sedentary: t('В основном сижу'),
  light: t('Немного двигаюсь'),
  moderate: t('Много хожу'),
  active: t('Физическая работа'),
};

export const activityHints: Record<ActivityLevel, string> = {
  sedentary: t('Офис, учёба, мало ходьбы'),
  light: t('Прогулки и домашние дела'),
  moderate: t('На ногах большую часть дня'),
  active: t('Тяжёлая работа или много спорта вне плана'),
};

export const baselineLabels: Record<Baseline, string> = {
  low: t('Пока ни одного или пару'),
  medium: t('Примерно до 15'),
  high: t('Больше 15'),
};

export const sleepChoices = [
  { hours: 5.5, label: t('Меньше 6 часов') },
  { hours: 6.5, label: t('6–7 часов') },
  { hours: 7.5, label: t('7–8 часов') },
  { hours: 8.5, label: t('Больше 8 часов') },
];

export const nutritionModeLabels: Record<NutritionMode, string> = {
  targets: t('Считать калории и БЖУ'),
  protein: t('Следить только за белком'),
  diary: t('Только дневник, без целей'),
};

export const dietLabels: Record<Diet, string> = {
  any: t('Без ограничений'),
  vegetarian: t('Вегетарианское'),
  vegan: t('Веганское'),
};

export const limitationLabels: Record<Limitation, string> = {
  shoulders: t('Плечи'),
  elbows: t('Локти'),
  wrists: t('Запястья'),
  neck: t('Шея'),
  lower_back: t('Поясница'),
  hips: t('Тазобедренные суставы'),
  knees: t('Колени'),
  ankles: t('Голеностопы'),
};
