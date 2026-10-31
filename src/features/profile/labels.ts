import type { Equipment, Experience, Goal, Limitation, Sex } from '@/domains/profile/profile';

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

export const limitationLabels: Record<Limitation, string> = {
  shoulders: 'Плечи',
  knees: 'Колени',
  lower_back: 'Поясница',
};
