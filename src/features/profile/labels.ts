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
  muscle: 'Рост мышц за счёт объёма',
  fat_loss: 'Больше повторов в подходах',
  recomposition: 'Сбалансированная нагрузка',
  strength: 'Упор на рабочие веса',
  maintenance: 'Регулярно, без гонки за весом',
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
  dumbbells: 'Скамья не нужна',
  bar: 'Дома или на площадке',
  bodyweight: 'Без инвентаря',
};

export const limitationLabels: Record<Limitation, string> = {
  shoulders: 'Плечи',
  knees: 'Колени',
  lower_back: 'Поясница',
};
