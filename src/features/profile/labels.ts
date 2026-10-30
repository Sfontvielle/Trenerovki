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

export const experienceLabels: Record<Experience, string> = {
  beginner: 'Новичок, до 6 месяцев',
  intermediate: 'Средний, от 6 месяцев до 2 лет',
  advanced: 'Опытный, больше 2 лет',
};

export const equipmentLabels: Record<Equipment, string> = {
  gym: 'Тренажёрный зал',
  dumbbells: 'Гантели дома',
  bar: 'Свой вес и турник',
  bodyweight: 'Только свой вес',
};

export const limitationLabels: Record<Limitation, string> = {
  shoulders: 'Плечи',
  knees: 'Колени',
  lower_back: 'Поясница',
};
