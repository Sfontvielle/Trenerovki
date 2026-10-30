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

async function press(name: string | RegExp, role: 'button' | 'radio' = 'button') {
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
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[1]?.onPress?.();
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

    await type('Как вас зовут', 'Ислам');
    await type('Возраст', '17');
    await press('Далее');
    expect(screen.getByText(/приложение рассчитано на взрослых/)).toBeTruthy();

    await type('Возраст', '30');
    await press('Далее');
    await press('Не указывать', 'radio');
    await press('Далее');

    await press('Далее');
    expect(screen.getByText('Выберите вариант, чтобы продолжить')).toBeTruthy();

    await press('Стать сильнее', 'radio');
    await press('Далее');
    await press('Новичок, до 6 месяцев', 'radio');
    await press('Далее');
    await press('3', 'radio');
    await press('45 мин', 'radio');
    await press('Далее');
    await press('Тренажёрный зал', 'radio');
    await press('Далее');
    await press('Колени', 'radio');
    await press('Показать план');

    expect(screen.getByText('Ваш стартовый план')).toBeTruthy();
    expect(screen.queryByText(/Приседания/)).toBeNull();

    await press('Принять план');

    expect(await getProfile(database)).toMatchObject({ name: 'Ислам', goal: 'strength', limitations: ['knees'] });
    expect(await getProgram(database)).toHaveLength(3);
    expect(screen).toHavePathname('/');
    expect(await screen.findByText('Следующая тренировка')).toBeTruthy();
  });

  it('keeps the entered answers when going back', async () => {
    await renderRouter('./src/app');
    await screen.findByText('Начать');
    await press('Начать');
    await type('Как вас зовут', 'Ислам');
    await type('Возраст', '30');
    await press('Далее');
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
  });
});

describe('profile', () => {
  it('stores the theme and accent choice across restarts', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await press('Светлая', 'radio');
    await press('Розовый', 'radio');

    const settings = new SettingsRepository(database);
    expect(await settings.get('theme_preference')).toBe('light');
    expect(await settings.get('accent')).toBe('rose');
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

describe('failures', () => {
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
