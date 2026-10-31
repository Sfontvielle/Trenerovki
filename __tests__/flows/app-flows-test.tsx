import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';
import { Alert, Share } from 'react-native';

import type { Database } from '@/domains/data-platform/database';
import { openAppDatabase } from '@/domains/data-platform/expo-database';
import { migrate } from '@/domains/data-platform/migrations';
import { SettingsRepository } from '@/domains/data-platform/settings-repository';
import { completeOnboarding } from '@/domains/profile/complete-onboarding';
import type { Profile } from '@/domains/profile/profile';
import { getProfile } from '@/domains/profile/profile-repository';
import { generatePlan } from '@/domains/program/generate-plan';
import { getProgram } from '@/domains/program/program-repository';
import { listCompletedSessions } from '@/domains/progress/progress-repository';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

jest.mock('@/domains/data-platform/expo-database', () => ({ openAppDatabase: jest.fn() }));
jest.mock('@/domains/data-platform/ids', () => {
  let next = 0;
  return { createId: () => `generated-${++next}` };
});

let nextId = 0;
const createId = () => `seed-${++nextId}`;

const profile: Profile = {
  name: 'Ислам',
  sex: null,
  age: 30,
  weightKg: 80,
  goal: 'muscle',
  experience: 'intermediate',
  daysPerWeek: 3,
  sessionMinutes: 60,
  equipment: 'gym',
  limitations: [],
};

let database: Database;
let confirmButton = 1;

async function press(name: string | RegExp, role: 'button' | 'radio' | 'checkbox' = 'button') {
  await act(async () => {
    await fireEvent.press(screen.getAllByRole(role, { name })[0]);
  });
}

async function type(label: string, text: string) {
  await act(async () => {
    await fireEvent.changeText(screen.getByLabelText(label), text);
  });
}

async function seedProfile() {
  await completeOnboarding(database, profile, generatePlan(profile), createId, new Date());
}

async function seedOpenWorkout() {
  await seedProfile();
  const [day] = await getProgram(database);
  const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
  const sessionId = await engine.startSession({
    operationId: createId(),
    title: day.name,
    programDayId: day.id,
    exercises: day.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      plannedSets: exercise.targetSets,
      repsMin: exercise.repsMin,
      repsMax: exercise.repsMax,
    })),
  });
  const session = await engine.getSession(sessionId);
  await engine.logSet(session!.exercises[0].id, { weightKg: 60, reps: 10, rir: 2 }, createId());
  return engine;
}

beforeEach(async () => {
  database = createTestDatabase();
  await migrate(database);
  jest.mocked(openAppDatabase).mockReset();
  jest.mocked(openAppDatabase).mockResolvedValue(database);
  confirmButton = 1;
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[confirmButton]?.onPress?.();
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('new user', () => {
  it('walks through the welcome screen and the questionnaire to a saved plan', async () => {
    await renderRouter('./src/app');
    expect(await screen.findByText('Начать')).toBeTruthy();
    expect(screen).toHavePathname('/welcome');

    await press('Начать');
    expect(screen).toHavePathname('/onboarding');

    expect(screen.getByRole('button', { name: 'Продолжить', disabled: true })).toBeTruthy();
    await type('Как вас зовут', 'Ислам');
    await press('Продолжить');

    await type('Возраст', '17');
    expect(screen.getByText(/приложение рассчитано на взрослых/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Продолжить', disabled: true })).toBeTruthy();
    await type('Возраст', '30');
    await press('Продолжить');

    await press('Пропустить');
    await press('Пропустить');

    expect(screen.getByRole('button', { name: 'Продолжить', disabled: true })).toBeTruthy();
    await press('Стать сильнее', 'radio');
    await press('Продолжить');
    await press('Новичок', 'radio');
    await press('Продолжить');
    await press(/^3 раза/, 'radio');
    await press('Продолжить');
    await press('45 минут', 'radio');
    await press('Продолжить');
    await press('Тренажёрный зал', 'radio');
    await press('Продолжить');
    await press('Колени', 'checkbox');
    await press('Показать план');

    expect(await screen.findByText('Ваш стартовый план', {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.queryByText(/Приседания/)).toBeNull();

    await press('Принять план');

    expect(await getProfile(database)).toMatchObject({ name: 'Ислам', goal: 'strength', limitations: ['knees'] });
    expect(await getProgram(database)).toHaveLength(3);
    expect(screen).toHavePathname('/');
    expect(await screen.findByText('Следующая тренировка')).toBeTruthy();
  });

  it('takes the age from the wheel and the weight from the ruler', async () => {
    await renderRouter('./src/app');
    await screen.findByText('Начать');
    await press('Начать');
    await type('Как вас зовут', 'Ислам');
    await press('Продолжить');

    expect(screen.getByRole('button', { name: 'Продолжить', disabled: true })).toBeTruthy();
    await act(async () => {
      await fireEvent.press(screen.getByText('35'));
    });
    await press('Продолжить');
    await press('Женщина', 'radio');
    await press('Продолжить');

    expect(screen.getByRole('button', { name: 'Пропустить' })).toBeTruthy();
    await press('Вес: больше');
    expect(screen.getByLabelText('Вес, кг').props.value).toBe('75,5');
    await type('Вес, кг', '500');
    expect(screen.getByText(/Укажите вес от 30 до 300 кг/)).toBeTruthy();
    await type('Вес, кг', '62,5');
    await press('Продолжить');

    await press('Стать сильнее', 'radio');
    await press('Продолжить');
    await press('Средний', 'radio');
    await press('Продолжить');
    await press(/^4 раза/, 'radio');
    await press('Продолжить');
    await press('60 минут', 'radio');
    await press('Продолжить');
    await press('Гантели дома', 'radio');
    await press('Продолжить');
    await press('Показать план');
    await screen.findByText('Ваш стартовый план', {}, { timeout: 4000 });
    await press('Принять план');

    expect(await getProfile(database)).toMatchObject({
      age: 35,
      sex: 'female',
      weightKg: 62.5,
      daysPerWeek: 4,
      equipment: 'dumbbells',
    });
  });

  it('leaves the age empty until it is chosen', async () => {
    await renderRouter('./src/app');
    await screen.findByText('Начать');
    await press('Начать');
    await type('Как вас зовут', 'Ислам');
    await press('Продолжить');

    expect(screen.getByLabelText('Возраст').props.value).toBe('');
    expect(screen.getByRole('button', { name: 'Продолжить', disabled: true })).toBeTruthy();
  });

  it('returns to the welcome screen from the first question', async () => {
    await renderRouter('./src/app');
    await screen.findByText('Начать');
    await press('Начать');

    await press('Назад');

    expect(screen).toHavePathname('/welcome');
  });

  it('keeps the entered answers when going back', async () => {
    await renderRouter('./src/app');
    await screen.findByText('Начать');
    await press('Начать');
    await type('Как вас зовут', 'Ислам');
    await press('Продолжить');
    await press('Назад');

    expect(screen.getByLabelText('Как вас зовут').props.value).toBe('Ислам');
  });
});

describe('workout', () => {
  it('records a set, finishes the workout and shows it in history and progress', async () => {
    await seedProfile();
    await renderRouter('./src/app');
    expect(await screen.findByText('Следующая тренировка')).toBeTruthy();

    await press('Начать тренировку');
    expect(await screen.findByText('Завершить можно после первого записанного подхода.')).toBeTruthy();

    const [day] = await getProgram(database);
    const first = await database.first<{ id: string }>(
      'SELECT id FROM session_exercise ORDER BY position LIMIT 1',
    );
    await testRouter.push(`/workout/${first!.id}`);
    expect(day.exercises.length).toBeGreaterThan(0);

    await type('Вес, кг', '62,5');
    await type('Повторы', '10');
    await type('Запас повторов', '2');
    await press('Записать подход');

    expect(await screen.findByText('Записанные подходы')).toBeTruthy();
    expect(await database.all('SELECT weight_kg, reps, rir FROM workout_set')).toEqual([
      { weight_kg: 62.5, reps: 10, rir: 2 },
    ]);

    await press('К обзору тренировки');
    await press('Завершить тренировку');
    expect(Alert.alert).toHaveBeenCalledWith('Завершить тренировку?', expect.any(String), expect.any(Array));

    expect(await screen.findByText('Объём: 625 кг')).toBeTruthy();
    expect(screen.getByText(/Готово/)).toBeTruthy();

    await press('Готово');
    await testRouter.navigate('/progress');
    expect(await screen.findByText('Рекорды')).toBeTruthy();
    expect(screen.getByText('62,5 кг × 10')).toBeTruthy();
  });

  it('rejects an impossible set and writes nothing', async () => {
    await seedOpenWorkout();
    const exercise = await database.first<{ id: string }>(
      'SELECT id FROM session_exercise ORDER BY position LIMIT 1 OFFSET 1',
    );
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Продолжить');
    await press('Продолжить');
    await screen.findByText('Пауза');
    await testRouter.push(`/workout/${exercise!.id}`);
    await screen.findByText('Записать подход');

    await type('Повторы', '0');
    await press('Записать подход');

    expect(await screen.findByText(/Проверьте значения/)).toBeTruthy();
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
  });

  it('restores an interrupted workout after a restart without losing sets', async () => {
    await seedOpenWorkout();

    await renderRouter('./src/app');

    expect(await screen.findByText('Тренировка не завершена')).toBeTruthy();
    const session = await database.first<{ state: string }>('SELECT state FROM workout_session');
    expect(session?.state).toBe('paused');
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
  });

  it('pauses and resumes', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Продолжить');

    await press('Продолжить');
    expect(await screen.findByText('Пауза')).toBeTruthy();

    await press('Пауза');
    expect(await screen.findByText('Продолжить')).toBeTruthy();
  });

  it('hides the set form during a pause', async () => {
    await seedOpenWorkout();
    const exercise = await database.first<{ id: string }>(
      'SELECT id FROM session_exercise ORDER BY position LIMIT 1',
    );

    await renderRouter('./src/app', { initialUrl: `/workout/${exercise!.id}` });

    expect(await screen.findByText(/Тренировка на паузе/)).toBeTruthy();
    expect(screen.queryByText('Записать подход')).toBeNull();
  });

  it('cancels a workout after confirmation and keeps it out of progress', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Отменить тренировку');

    await press('Отменить тренировку');

    await screen.findByText('Следующая тренировка');
    const session = await database.first<{ state: string }>('SELECT state FROM workout_session');
    expect(session?.state).toBe('cancelled');
    expect(await listCompletedSessions(database)).toEqual([]);
  });
});

describe('profile', () => {
  it('stores the theme and accent choice', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await press('Светлая', 'radio');
    await press('Розовый', 'radio');

    const settings = new SettingsRepository(database);
    expect(await settings.get('theme_preference')).toBe('light');
    expect(await settings.get('accent')).toBe('rose');
  });

  it('applies the stored theme and accent on launch', async () => {
    await seedProfile();
    const settings = new SettingsRepository(database);
    await settings.set('theme_preference', 'light');
    await settings.set('accent', 'rose');

    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    expect(screen.getByRole('radio', { name: 'Светлая', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Розовый', checked: true })).toBeTruthy();
  });

  it('exports the data through the share sheet', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await press('Экспортировать данные');

    expect(JSON.parse(share.mock.calls[0][0].message as string).format).toBe('ironvant-export');
  });

  it('deletes everything after confirmation and returns to the welcome screen', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await press('Удалить все данные');

    await screen.findByText('Начать');
    expect(await getProfile(database)).toBeNull();
    expect(await database.all('SELECT id FROM workout_session')).toEqual([]);
  });
});

describe('navigation', () => {
  it('keeps the questionnaire out of reach after it is completed', async () => {
    await seedProfile();

    await renderRouter('./src/app', { initialUrl: '/welcome' });

    expect(await screen.findByText('Следующая тренировка')).toBeTruthy();
    expect(screen).toHavePathname('/');
  });

  it('returns to the tab a past workout was opened from', async () => {
    const engine = await seedOpenWorkout();
    const open = await engine.getOpenSession();
    await engine.completeSession(open!.id, createId());
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/progress');
    await screen.findByText('История');

    await press(/Всё тело/);
    expect(await screen.findByText('Готово')).toBeTruthy();
    await press('Готово');

    expect(screen).toHavePathname('/progress');
  });
});

describe('editing recorded sets', () => {
  async function openLoggedExercise() {
    const engine = await seedOpenWorkout();
    const open = await engine.getOpenSession();
    const exercise = open!.exercises[0];
    await engine.logSet(exercise.id, { weightKg: 70, reps: 8, rir: 1 }, createId());
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Продолжить');
    await press('Продолжить');
    await screen.findByText('Пауза');
    await press(/Подходы: 2 из/);
    await screen.findByText('Записанные подходы');
  }

  const fieldValue = (label: string) => screen.getByLabelText(label).props.value;

  it('prefills the form from the last set', async () => {
    await openLoggedExercise();

    expect(fieldValue('Вес, кг')).toBe('70');
    expect(fieldValue('Повторы')).toBe('8');
  });

  it('changes a set in place', async () => {
    await openLoggedExercise();

    await press('Изменить');
    expect(fieldValue('Вес, кг')).toBe('60');
    await type('Вес, кг', '62,5');
    await press('Сохранить изменения');

    expect(await screen.findByText('1. 62,5 кг × 10, запас 2')).toBeTruthy();
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(2);
    expect(fieldValue('Вес, кг')).toBe('70');
  });

  it('restores the prefill when editing is abandoned', async () => {
    await openLoggedExercise();

    await press('Изменить');
    await press('Отмена');

    expect(fieldValue('Вес, кг')).toBe('70');
    expect(screen.queryByText('Сохранить изменения')).toBeNull();
  });

  it('keeps editing and the row when the new value is invalid', async () => {
    await openLoggedExercise();

    await press('Изменить');
    await type('Повторы', '0');
    await press('Сохранить изменения');

    expect(await screen.findByText(/Проверьте значения/)).toBeTruthy();
    expect(screen.getByText('Сохранить изменения')).toBeTruthy();
    expect(await database.first('SELECT reps FROM workout_set WHERE position = 1')).toEqual({ reps: 10 });
  });

  it('deletes a set after confirmation and renumbers the rest', async () => {
    await openLoggedExercise();

    await press('Удалить');

    expect(await screen.findByText('1. 70 кг × 8, запас 1')).toBeTruthy();
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
  });

  it('keeps a set when deletion is declined', async () => {
    await openLoggedExercise();
    confirmButton = 0;

    await press('Удалить');

    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(2);
  });
});

describe('weight suggestion and safety', () => {
  async function seedStrongSession() {
    await seedProfile();
    const [day] = await getProgram(database);
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    const planned = day.exercises[0];
    const exercises = [
      {
        exerciseId: planned.exerciseId,
        plannedSets: 1,
        repsMin: planned.repsMin,
        repsMax: planned.repsMax,
      },
    ];
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: day.name,
      programDayId: day.id,
      exercises,
    });
    const session = await engine.getSession(sessionId);
    await engine.logSet(session!.exercises[0].id, { weightKg: 80, reps: planned.repsMax, rir: 2 }, createId());
    await engine.completeSession(sessionId, createId());

    const nextId = await engine.startSession({
      operationId: createId(),
      title: day.name,
      programDayId: day.id,
      exercises,
    });
    const next = await engine.getSession(nextId);
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Продолжить');
    await press('Продолжить');
    await screen.findByText('Пауза');
    await testRouter.push(`/workout/${next!.exercises[0].id}`);
    await screen.findByText('Записать подход');
  }

  it('offers a heavier weight and applies it only on request', async () => {
    await seedStrongSession();

    expect(screen.getByText('Попробовать 82,5 кг?')).toBeTruthy();
    expect(screen.getByLabelText('Вес, кг').props.value).toBe('80');

    await press('Подставить вес');

    expect(screen.getByLabelText('Вес, кг').props.value).toBe('82,5');
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
  });

  it('withdraws the suggestion after discomfort is reported', async () => {
    await seedStrongSession();

    await press('Боль или дискомфорт');

    expect(await screen.findByText(/Вы отмечали дискомфорт/)).toBeTruthy();
    expect(screen.queryByText('Попробовать 82,5 кг?')).toBeNull();
    expect(Alert.alert).toHaveBeenCalledWith('Остановите упражнение', expect.stringContaining('врачу'), expect.any(Array));
  });
});

describe('adding exercises', () => {
  async function openAddScreen() {
    await seedProfile();
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    await engine.startSession({
      operationId: createId(),
      title: 'Свободная тренировка',
      programDayId: null,
      exercises: [],
    });
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Продолжить');
    await press('Продолжить');
    await screen.findByText('Пауза');
    await press('Добавить упражнение');
    await screen.findByLabelText('Найти упражнение');
  }

  it('finds an exercise typed without ё and adds it once despite a double tap', async () => {
    await openAddScreen();

    await type('Найти упражнение', 'штанги лежа');
    expect(screen.queryByText('Ничего не найдено. Попробуйте другое название.')).toBeNull();

    const row = screen.getAllByRole('button', { name: /Жим штанги лёжа/ })[0];
    await act(async () => {
      fireEvent.press(row);
      fireEvent.press(row);
    });

    expect(await database.all('SELECT id FROM session_exercise')).toHaveLength(1);
  });

  it('says when nothing matches', async () => {
    await openAddScreen();

    await type('Найти упражнение', 'несуществующее');

    expect(screen.getByText('Ничего не найдено. Попробуйте другое название.')).toBeTruthy();
  });

  it('removes an exercise added by mistake', async () => {
    await openAddScreen();
    await press(/Подъёмы на носки/);
    await screen.findByText(/Подходы: 0/);

    await press(/Подходы: 0/);
    await press('Убрать из тренировки');

    expect(await database.all('SELECT id FROM session_exercise')).toEqual([]);
  });
});

describe('progress screens', () => {
  it('opens the trend chart from a record', async () => {
    const engine = await seedOpenWorkout();
    const open = await engine.getOpenSession();
    await engine.completeSession(open!.id, createId());
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/progress');
    await screen.findByText('Рекорды');

    await press(/60 кг × 10/);

    expect(await screen.findByText('Лучший вес по тренировкам')).toBeTruthy();
  });

  it('builds the chart from reps for bodyweight work', async () => {
    await seedProfile();
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Дома',
      programDayId: null,
      exercises: [{ exerciseId: 'push-up', plannedSets: 1, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    await engine.logSet(session!.exercises[0].id, { weightKg: null, reps: 15, rir: null }, createId());
    await engine.completeSession(sessionId, createId());

    await renderRouter('./src/app', { initialUrl: '/exercise-progress/push-up' });

    expect(await screen.findByText('Лучшие повторы по тренировкам')).toBeTruthy();
  });
});

describe('recovery through the interface', () => {
  it('resumes an interrupted workout and excludes the gap from its duration', async () => {
    await seedOpenWorkout();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    await database.run('UPDATE workout_session SET started_at = ?, last_activity_at = ?', [
      threeHoursAgo,
      threeHoursAgo,
    ]);

    await renderRouter('./src/app');
    await screen.findByText('Тренировка не завершена');

    await press('Продолжить тренировку');
    await screen.findByText('Продолжить');
    await press('Продолжить');
    await screen.findByText('Пауза');
    await press(/Подходы: 1 из/);
    await screen.findByText('Записать подход');
    await press('Записать подход');
    await screen.findByText(/^2\. /);
    await press('К обзору тренировки');
    await press('Завершить тренировку');
    await screen.findByText('Готово');

    const session = await database.first<{
      state: string;
      started_at: string;
      finished_at: string;
      paused_ms: number;
    }>('SELECT * FROM workout_session');
    expect(session?.state).toBe('completed');
    const duration = Date.parse(session!.finished_at) - Date.parse(session!.started_at) - session!.paused_ms;
    expect(duration).toBeLessThan(60 * 1000);
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(2);
  });
});

describe('declined confirmations', () => {
  it('keeps everything when deleting all data is declined', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');
    confirmButton = 0;

    await press('Удалить все данные');

    expect(await getProfile(database)).not.toBeNull();
    expect(screen).toHavePathname('/profile');
  });

  it('keeps the workout when cancelling is declined', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Отменить тренировку');
    confirmButton = 0;

    await press('Отменить тренировку');

    const session = await database.first<{ state: string }>('SELECT state FROM workout_session');
    expect(session?.state).toBe('paused');
  });

  it('keeps the workout open when finishing is declined', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Завершить тренировку');
    confirmButton = 0;

    await press('Завершить тренировку');

    const session = await database.first<{ state: string }>('SELECT state FROM workout_session');
    expect(session?.state).toBe('paused');
  });
});

describe('changing the answers', () => {
  it('replaces the plan after confirmation and keeps the history', async () => {
    const engine = await seedOpenWorkout();
    const open = await engine.getOpenSession();
    await engine.completeSession(open!.id, createId());
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await press('Изменить ответы и план');
    await screen.findByLabelText('Как вас зовут');
    expect(screen.getByLabelText('Как вас зовут').props.value).toBe('Ислам');
    for (let step = 0; step < 9; step += 1) {
      await press(/^(Продолжить|Пропустить)$/);
    }
    await press('Плечи', 'checkbox');
    await press('Показать план');

    expect(await screen.findByText('Ваш новый план', {}, { timeout: 4000 })).toBeTruthy();
    expect(await getProfile(database)).toMatchObject({ limitations: [] });

    await press('Принять план');

    expect(await getProfile(database)).toMatchObject({ limitations: ['shoulders'] });
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
    expect(await database.all("SELECT id FROM workout_session WHERE state = 'completed'")).toHaveLength(1);
  });
});

describe('nutrition diary', () => {
  async function openDiary() {
    await seedProfile();
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/nutrition');
    await screen.findByRole('button', { name: 'Добавить: Завтрак' });
  }

  async function addOats() {
    await press('Добавить: Завтрак');
    await press('Новый продукт');
    await type('Название', 'Овсянка');
    await type('Калории на 100 г', '366');
    await type('Белки на 100 г', '12');
    await type('Жиры на 100 г', '6');
    await type('Углеводы на 100 г', '62');
    await type('Вес порции, г', '50');
    expect(screen.getByText('183 ккал')).toBeTruthy();
    await press('Записать');
  }

  it('records a new food and shows it in the day totals and on the home screen', async () => {
    await openDiary();

    await addOats();

    expect(await screen.findByText('50 г, 183 ккал')).toBeTruthy();
    expect(await database.all('SELECT grams FROM food_entry')).toEqual([{ grams: 50 }]);

    await testRouter.navigate('/');
    expect(await screen.findByText('Питание сегодня')).toBeTruthy();
    expect(screen.getAllByText('183 ккал').length).toBeGreaterThan(0);
  });

  it('reuses a saved food', async () => {
    await openDiary();
    await addOats();
    await screen.findByText('50 г, 183 ккал');

    await press('Добавить: Обед');
    await press(/Овсянка/);
    await type('Вес порции, г', '60,5');
    await press('Записать');

    expect(await screen.findByText('60,5 г, 221 ккал')).toBeTruthy();
    expect(await database.all('SELECT id FROM food')).toHaveLength(1);
  });

  it('warns about impossible values and writes nothing', async () => {
    await openDiary();
    await press('Добавить: Обед');
    await press('Новый продукт');
    await type('Название', 'Ошибка');
    await type('Калории на 100 г', '1000');
    await type('Белки на 100 г', '10');
    await type('Жиры на 100 г', '10');
    await type('Углеводы на 100 г', '10');
    await type('Вес порции, г', '100');

    await press('Записать');

    expect(await screen.findByText(/Проверьте значения на 100 г/)).toBeTruthy();
    expect(await database.all('SELECT id FROM food_entry')).toEqual([]);
  });

  it('warns when calories do not match the macros but still allows saving', async () => {
    await openDiary();
    await press('Добавить: Обед');
    await press('Новый продукт');
    await type('Калории на 100 г', '10');
    await type('Белки на 100 г', '20');
    await type('Жиры на 100 г', '20');
    await type('Углеводы на 100 г', '20');

    expect(screen.getByText(/Калории не сходятся/)).toBeTruthy();
  });

  it('changes a portion and deletes an entry after confirmation', async () => {
    await openDiary();
    await addOats();
    await screen.findByText('50 г, 183 ккал');

    await press(/Овсянка/);
    await screen.findByLabelText('Вес порции, г');
    await type('Вес порции, г', '100');
    await press('Сохранить');
    expect(await screen.findByText('100 г, 366 ккал')).toBeTruthy();

    await press(/Овсянка/);
    await screen.findByText('Удалить запись');
    confirmButton = 0;
    await press('Удалить запись');
    expect(await database.all('SELECT id FROM food_entry')).toHaveLength(1);

    confirmButton = 1;
    await press('Удалить запись');
    expect(await database.all('SELECT id FROM food_entry')).toEqual([]);
  });

  it('moves between days and does not go into the future', async () => {
    await openDiary();
    await addOats();
    await screen.findByText('50 г, 183 ккал');

    expect(screen.getByRole('button', { name: 'Следующий день', disabled: true })).toBeTruthy();

    await press('Предыдущий день');

    expect(await screen.findByText('Вчера')).toBeTruthy();
    expect(screen.queryByText('50 г, 183 ккал')).toBeNull();
  });

  it('keeps the form when saving fails', async () => {
    await openDiary();
    await press('Добавить: Обед');
    await press('Новый продукт');
    await type('Название', 'Рис');
    await type('Калории на 100 г', '340');
    await type('Белки на 100 г', '7');
    await type('Жиры на 100 г', '1');
    await type('Углеводы на 100 г', '76');
    await type('Вес порции, г', '80');
    const transaction = jest
      .spyOn(database, 'transaction')
      .mockRejectedValueOnce(new Error('database or disk is full'));

    await press('Записать');

    expect(await screen.findByText(/Запись не сохранена.*закончилось место/)).toBeTruthy();
    expect(screen.getByLabelText('Название').props.value).toBe('Рис');
    transaction.mockRestore();
  });
});

describe('failures', () => {
  it('keeps the entered values and retries a failed save exactly once', async () => {
    await seedOpenWorkout();
    const exercise = await database.first<{ id: string }>(
      'SELECT id FROM session_exercise ORDER BY position LIMIT 1 OFFSET 1',
    );
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByText('Продолжить');
    await press('Продолжить');
    await screen.findByText('Пауза');
    await testRouter.push(`/workout/${exercise!.id}`);
    await screen.findByText('Записать подход');
    const logSet = jest
      .spyOn(WorkoutEngine.prototype, 'logSet')
      .mockRejectedValueOnce(new Error('database or disk is full'));

    await type('Вес, кг', '50');
    await type('Повторы', '9');
    await press('Записать подход');

    expect(await screen.findByText(/Подход не сохранён.*закончилось место/)).toBeTruthy();
    expect(screen.getByLabelText('Вес, кг').props.value).toBe('50');

    await press('Записать подход');

    await screen.findByText('Записанные подходы');
    expect(logSet.mock.calls[0][2]).toBe(logSet.mock.calls[1][2]);
    expect(
      await database.all('SELECT id FROM workout_set WHERE session_exercise_id = ?', [exercise!.id]),
    ).toHaveLength(1);
  });

  it('opens the app when recovering an interrupted workout fails', async () => {
    await seedOpenWorkout();
    jest
      .spyOn(WorkoutEngine.prototype, 'recoverInterruptedSession')
      .mockRejectedValueOnce(new Error('disk'));

    await renderRouter('./src/app');

    expect(await screen.findByText('Тренировка не завершена')).toBeTruthy();
  });

  it('opens the app when the theme settings cannot be read', async () => {
    await seedProfile();
    jest.spyOn(SettingsRepository.prototype, 'get').mockRejectedValue(new Error('disk'));

    await renderRouter('./src/app');

    expect(await screen.findByText('Следующая тренировка')).toBeTruthy();
  });

  it('offers a retry when the data cannot be opened', async () => {
    jest.mocked(openAppDatabase).mockRejectedValueOnce(new Error('disk'));
    await seedProfile();

    await renderRouter('./src/app');

    expect(await screen.findByText('Не удалось загрузить данные')).toBeTruthy();

    await press('Повторить');

    expect(await screen.findByText('Следующая тренировка')).toBeTruthy();
  });

  it('tells the user when the data comes from a newer app version', async () => {
    await database.run(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (999, 'future', 'now')",
    );

    await renderRouter('./src/app');

    expect(await screen.findByText(/Обновите IRONVANT/)).toBeTruthy();
  });
});
