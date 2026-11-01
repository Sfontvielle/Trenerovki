import { exerciseName } from '@/domains/exercises/catalog';
import { restTimer, setAutoRestEnabled } from '@/features/workout/rest-store';
import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter, waitFor } from 'expo-router/testing-library';
import { Alert, AppState } from 'react-native';

import type { Database } from '@/domains/data-platform/database';
import { openAppDatabase } from '@/domains/data-platform/expo-database';
import { migrate } from '@/domains/data-platform/migrations';
import { SettingsRepository } from '@/domains/data-platform/settings-repository';
import { completeOnboarding } from '@/domains/profile/complete-onboarding';
import type { Profile } from '@/domains/profile/profile';
import { getProfile } from '@/domains/profile/profile-repository';
import { exportAllData } from '@/domains/data-platform/data-transfer';
import { pickBackup, shareBackup, shareWorkoutsCsv } from '@/features/profile/backup';
import { encryptBackup } from '@/domains/data-platform/backup-crypto';
import { generatePlan } from '@/domains/program/generate-plan';
import { getProgram } from '@/domains/program/program-repository';
import { listCompletedSessions } from '@/domains/progress/progress-repository';
import { dayKey, shiftDay } from '@/domains/nutrition/nutrition';
import { getManualTarget, logFood } from '@/domains/nutrition/nutrition-repository';
import { WorkoutEngine } from '@/domains/workout/workout-engine';
import { createTestDatabase } from '../../test-support/test-database';

jest.mock('@/domains/data-platform/expo-database', () => ({ openAppDatabase: jest.fn() }));
jest.mock('expo-sensors', () => ({
  Pedometer: {
    isAvailableAsync: jest.fn(async () => false),
    getPermissionsAsync: jest.fn(async () => ({ granted: false, canAskAgain: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    getStepCountAsync: jest.fn(async () => ({ steps: 0 })),
  },
}));
jest.mock('expo-audio', () => ({
  createAudioPlayer: jest.fn(() => ({ play: jest.fn(), seekTo: jest.fn(async () => {}) })),
  setAudioModeAsync: jest.fn(async () => {}),
}));
jest.mock('expo-camera', () => ({
  CameraView: () => null,
  useCameraPermissions: () => [{ granted: true, canAskAgain: true }, jest.fn()],
}));
jest.mock('@/features/profile/backup', () => ({
  pickBackup: jest.fn(),
  shareBackup: jest.fn(),
  shareWorkoutsCsv: jest.fn(),
  shareLatestSnapshot: jest.fn(),
}));
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
  sessionMinutes: 45,
  equipment: 'gym',
  limitations: [],
  trainingDays: [],
  heightCm: null,
  activityLevel: null,
  usualSleepHours: null,
  baseline: null,
  nutritionMode: 'targets',
  diet: 'any',
};

type ExerciseStart = Parameters<WorkoutEngine['startSession']>[0]['exercises'][number];

let database: Database;
let confirmButton = 1;
let appStateListener: jest.SpyInstance;

function moveClock(days: number) {
  jest.useFakeTimers({
    now: Date.now() + days * 24 * 60 * 60 * 1000,
    doNotFake: [
      'cancelAnimationFrame',
      'cancelIdleCallback',
      'clearImmediate',
      'clearInterval',
      'clearTimeout',
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'requestIdleCallback',
      'setImmediate',
      'setInterval',
      'setTimeout',
    ],
  });
}

async function returnToApp() {
  await act(async () => {
    appStateListener.mock.lastCall?.[1]('active');
  });
}

async function press(name: string | RegExp, role: 'button' | 'radio' | 'checkbox' | 'tab' = 'button') {
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

async function openExerciseByName(position: number) {
  const row = await database.first<{ exercise_id: string }>(
    'SELECT exercise_id FROM session_exercise ORDER BY position LIMIT 1 OFFSET ?',
    [position],
  );
  await press(new RegExp(`^${exerciseName(row!.exercise_id)}`));
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
  jest.mocked(pickBackup).mockReset();
  jest.mocked(shareBackup).mockReset();
  appStateListener = jest.spyOn(AppState, 'addEventListener');
  jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
    buttons?.[confirmButton]?.onPress?.();
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  restTimer.stop();
  setAutoRestEnabled(true);
  jest.useRealTimers();
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
    await press('Пропустить');

    expect(screen.getByRole('button', { name: 'Продолжить', disabled: true })).toBeTruthy();
    await press('Стать сильнее', 'radio');
    await press('Продолжить');
    await press('Новичок', 'radio');
    await press('Продолжить');
    await press('Пропустить');
    await press(/^3 раза/, 'radio');
    await press('Продолжить');
    await press('Пропустить');
    await press('45 минут', 'radio');
    await press('Продолжить');
    await press('Тренажёрный зал', 'radio');
    await press('Продолжить');
    await press('Колени', 'checkbox');
    await press('Продолжить');
    await press('Пропустить');
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
    await press('Не указывать вес');
    expect(screen.getByRole('button', { name: 'Пропустить' })).toBeTruthy();
    expect(screen.getByLabelText('Вес, кг').props.value).toBe('');
    await type('Вес, кг', '62,5');
    await press('Продолжить');
    await press('Пропустить');

    await press('Стать сильнее', 'radio');
    await press('Продолжить');
    await press('Средний', 'radio');
    await press('Продолжить');
    await press('Пропустить');
    await press(/^4 раза/, 'radio');
    await press('Продолжить');
    await press('Пн', 'checkbox');
    expect(screen.getByRole('button', { name: 'Продолжить', disabled: true })).toBeTruthy();
    await press('Вт', 'checkbox');
    await press('Чт', 'checkbox');
    await press('Сб', 'checkbox');
    await press('Продолжить');
    await press('60 минут', 'radio');
    await press('Продолжить');
    await press('Гантели дома', 'radio');
    await press('Продолжить');
    await press('Продолжить');
    await press('Пропустить');
    await press('Показать план');
    await screen.findByText('Ваш стартовый план', {}, { timeout: 4000 });
    await press('Принять план');

    expect(await getProfile(database)).toMatchObject({
      age: 35,
      sex: 'female',
      weightKg: 62.5,
      daysPerWeek: 4,
      equipment: 'dumbbells',
      trainingDays: [1, 2, 4, 6],
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

    await testRouter.back();
    await press('Завершить тренировку');
    expect(Alert.alert).toHaveBeenCalledWith('Завершить тренировку?', expect.any(String), expect.any(Array));

    expect(await screen.findByText('Тренировка завершена')).toBeTruthy();
    expect(screen.getByLabelText('Объём, кг: 625')).toBeTruthy();
    expect(screen.getByText(/Готово/)).toBeTruthy();

    await press('Готово');
    await testRouter.navigate('/progress');
    await press('Рекорды', 'tab');
    expect(screen.getByText('62,5 кг × 10')).toBeTruthy();
  });

  it('rejects an impossible set and writes nothing', async () => {
    await seedOpenWorkout();
    const exercise = await database.first<{ id: string }>(
      'SELECT id FROM session_exercise ORDER BY position LIMIT 1 OFFSET 1',
    );
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
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

    expect(await screen.findByText('Тренировка была прервана')).toBeTruthy();
    const session = await database.first<{ state: string }>('SELECT state FROM workout_session');
    expect(session?.state).toBe('paused');
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
  });

  it('pauses and resumes', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });

    await press('Продолжить');
    expect(await screen.findByRole('button', { name: 'Пауза' })).toBeTruthy();

    await press('Пауза');
    expect(await screen.findByRole('button', { name: 'Продолжить' })).toBeTruthy();
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

  it('saves a backup file', async () => {
    jest.mocked(shareBackup).mockResolvedValueOnce(true);
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Сохранить резервную копию');

    expect(shareBackup).toHaveBeenCalledWith(database, null);
    expect(await screen.findByText(/^Резервная копия передана/)).toBeTruthy();
  });

  it('restores a backup after confirmation and refreshes the app', async () => {
    await seedProfile();
    const backup = await exportAllData(database);
    await database.run("UPDATE profile SET name = 'Другое имя'");
    jest.mocked(pickBackup).mockResolvedValueOnce(backup);
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Восстановить из копии');

    expect(await screen.findByText('Данные восстановлены из копии.')).toBeTruthy();
    expect(await getProfile(database)).toMatchObject({ name: 'Ислам' });
  });

  it('shows what is in the backup before replacing anything', async () => {
    await seedProfile();
    const backup = await exportAllData(database);
    await database.run("UPDATE profile SET name = 'Другое имя'");
    jest.mocked(pickBackup).mockResolvedValueOnce(backup);
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    confirmButton = 0;

    await press('Восстановить из копии');

    expect(Alert.alert).toHaveBeenCalledWith(
      'Заменить все данные?',
      expect.stringContaining('тренировок 0'),
      expect.any(Array),
    );
    expect(await getProfile(database)).toMatchObject({ name: 'Другое имя' });
  });

  it('pauses a workout that arrives from a backup', async () => {
    await seedOpenWorkout();
    const backup = await exportAllData(database);
    await database.run("UPDATE workout_session SET state = 'cancelled'");
    jest.mocked(pickBackup).mockResolvedValueOnce(backup);
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Восстановить из копии');
    await screen.findByText('Данные восстановлены из копии.');

    const session = await database.first<{ state: string }>('SELECT state FROM workout_session');
    expect(session?.state).toBe('paused');
  });

  it('refuses to restore during an open workout', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Восстановить из копии');

    expect(await screen.findByText('Сначала завершите или отмените тренировку.')).toBeTruthy();
    expect(pickBackup).not.toHaveBeenCalled();
  });

  it('explains a wrong file and leaves the data alone', async () => {
    await seedProfile();
    jest.mocked(pickBackup).mockResolvedValueOnce('not a backup');
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Восстановить из копии');

    expect(await screen.findByText('Это не резервная копия IRONVANT.')).toBeTruthy();
    expect(await getProfile(database)).not.toBeNull();
  });

  it('does nothing when the file picker is cancelled', async () => {
    await seedProfile();
    jest.mocked(pickBackup).mockResolvedValueOnce(null);
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Восстановить из копии');

    expect(screen.queryByText('Данные восстановлены из копии.')).toBeNull();
    expect(await getProfile(database)).not.toBeNull();
  });

  it('stores the haptics choice', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await act(async () => {
      await fireEvent(screen.getByLabelText('Тактильный отклик'), 'valueChange', false);
    });

    expect(await new SettingsRepository(database).get('haptics')).toBe('off');
  });

  it('deletes everything after confirmation and returns to the welcome screen', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

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
    await press('История', 'tab');

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
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
    await openExerciseByName(0);
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
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
    await testRouter.push(`/workout/${next!.exercises[0].id}`);
    await screen.findByText('Записать подход');
  }

  it('offers a heavier weight and applies it only on request', async () => {
    await seedStrongSession();

    expect(screen.getByText('Попробовать 82,5 кг?')).toBeTruthy();
    expect(screen.getByLabelText('Вес, кг').props.value).toBe('80');

    await press('Подставить значения');

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
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
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
    await screen.findByText('Завершить можно после первого записанного подхода.');

    await openExerciseByName(0);
    await press(/Убрать из тренировки/);

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
    await press('Рекорды', 'tab');

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
    await screen.findByText('Тренировка была прервана');

    await press('Продолжить тренировку');
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
    await openExerciseByName(0);
    await screen.findByText('Записать подход');
    await press('Записать подход');
    await screen.findByText(/^2\. /);
    await testRouter.back();
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
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');
    confirmButton = 0;

    await press('Удалить все данные');

    expect(await getProfile(database)).not.toBeNull();
    expect(screen).toHavePathname('/data');
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
  it('saves new answers without touching a hand-edited plan', async () => {
    await seedProfile();
    await database.run("UPDATE program_exercise SET exercise_id = 'dead-bug' WHERE position = 1");
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await press('Изменить ответы и план');
    await screen.findByLabelText('Как вас зовут');
    await type('Как вас зовут', 'Новое имя');
    for (let step = 0; step < 14; step += 1) {
      await press(/^(Продолжить|Пропустить)$/);
    }
    await press('Показать план');
    await screen.findByText('Ваш новый план', {}, { timeout: 4000 });

    await press('Сохранить ответы, план не менять');

    expect(await getProfile(database)).toMatchObject({ name: 'Новое имя' });
    expect((await getProgram(database))[0].exercises[0].exerciseId).toBe('dead-bug');
  });

  it('replaces the plan after confirmation and keeps the history', async () => {
    const engine = await seedOpenWorkout();
    const open = await engine.getOpenSession();
    await engine.completeSession(open!.id, createId());
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Тема');

    await press('Изменить ответы и план');
    await screen.findByLabelText('Как вас зовут');
    expect(screen.getByLabelText('Как вас зовут').props.value).toBe('Ислам');
    for (let step = 0; step < 12; step += 1) {
      await press(/^(Продолжить|Пропустить)$/);
    }
    await press('Плечи', 'checkbox');
    await press(/^(Продолжить|Пропустить)$/);
    await press(/^(Продолжить|Пропустить)$/);
    await press('Показать план');

    expect(await screen.findByText('Ваш новый план', {}, { timeout: 4000 })).toBeTruthy();
    expect(await getProfile(database)).toMatchObject({ limitations: [] });

    await press('Заменить план');

    expect(await getProfile(database)).toMatchObject({ limitations: ['shoulders'] });
    expect(await database.all('SELECT id FROM workout_set')).toHaveLength(1);
    expect(await database.all("SELECT id FROM workout_session WHERE state = 'completed'")).toHaveLength(1);
  });
});

describe('plan and library', () => {
  it('replaces an exercise in a plan day', async () => {
    await seedProfile();
    const [day] = await getProgram(database);
    const first = day.exercises[0];
    await renderRouter('./src/app', { initialUrl: `/plan/${day.id}` });
    await screen.findAllByRole('button', { name: /^Заменить/ });

    await press(/^Заменить/);
    await screen.findByLabelText('Найти упражнение');
    await press(/Мёртвый жук/);

    const [edited] = await getProgram(database);
    expect(edited.exercises[0].id).toBe(first.id);
    expect(edited.exercises[0].exerciseId).toBe('dead-bug');
  });

  it('uses the right reps for a replacement and warns about a limited zone', async () => {
    await completeOnboarding(
      database,
      { ...profile, goal: 'strength', experience: 'advanced', limitations: ['shoulders'] },
      generatePlan({ ...profile, goal: 'strength', experience: 'advanced', limitations: ['shoulders'] }),
      createId,
      new Date(),
    );
    const [day] = await getProgram(database);
    await renderRouter('./src/app', { initialUrl: `/plan/${day.id}` });
    await screen.findAllByRole('button', { name: /^Заменить/ });

    await press(/^Заменить/);
    await screen.findByLabelText('Найти упражнение');
    await type('Найти упражнение', 'махи');
    await press(/Махи гантелями/);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Упражнение нагружает зону из ваших ограничений',
      expect.stringContaining('Плечи'),
      expect.any(Array),
    );
    const [edited] = await getProgram(database);
    expect(edited.exercises[0]).toMatchObject({ exerciseId: 'lateral-raise', repsMin: 10, repsMax: 15 });
  });

  it('removes an exercise after confirmation and keeps it when declined', async () => {
    await seedProfile();
    const [day] = await getProgram(database);
    await renderRouter('./src/app', { initialUrl: `/plan/${day.id}` });
    await screen.findAllByRole('button', { name: /^Убрать/ });

    confirmButton = 0;
    await press(/^Убрать/);
    expect((await getProgram(database))[0].exercises).toHaveLength(day.exercises.length);

    confirmButton = 1;
    await press(/^Убрать/);
    await screen.findAllByRole('button', { name: /^Заменить/ });
    expect((await getProgram(database))[0].exercises).toHaveLength(day.exercises.length - 1);
  });

  it('shows the technique of an exercise', async () => {
    await seedProfile();

    await renderRouter('./src/app', { initialUrl: '/exercises/bench-press' });

    expect(await screen.findByText('Как выполнять')).toBeTruthy();
    expect(screen.getByText(/Специалист её пока не проверял/)).toBeTruthy();
    expect(screen.getByText(/неотложной помощью/)).toBeTruthy();
  });

  it('adds a custom exercise and offers it in the library', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/exercises' });
    await screen.findByLabelText('Найти упражнение');

    await press('Новое упражнение');
    await screen.findByText('Сохранить упражнение');
    await type('Название', 'Жим в смите');
    await press('Грудь', 'radio');
    await press('Сохранить упражнение');

    expect(await screen.findByText('Грудь, своё упражнение')).toBeTruthy();
  });

  it('filters the library by muscle group', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/exercises' });
    await screen.findByLabelText('Найти упражнение');

    await press('Мышцы корпуса', 'radio');

    expect(await screen.findByText('Скручивания')).toBeTruthy();
    expect(screen.queryByText('Жим штанги лёжа')).toBeNull();
  });
});

describe('body weight and coach', () => {
  it('records today\'s body weight and shows it on the home screen', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/body-weight' });
    await screen.findByText('Записать вес');

    await press('Вес тела: больше');
    await press('Записать вес');

    expect(await screen.findByText('Обновить вес за сегодня')).toBeTruthy();
    expect(await database.all('SELECT weight_kg FROM body_weight')).toEqual([{ weight_kg: 80.1 }]);
  });

  it('never shows a weight other than the one it saves', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/body-weight' });
    await screen.findByText('Записать вес');

    await type('Вес тела, кг', '80');
    await press('Вес тела: больше');
    expect(screen.getByLabelText('Вес тела, кг').props.value).toBe('80,1');

    await type('Вес тела, кг', '');
    expect(screen.getByRole('button', { name: 'Записать вес', disabled: true })).toBeTruthy();

    await type('Вес тела, кг', '7');
    expect(screen.getByText(/Укажите вес от/)).toBeTruthy();
  });

  it('does not suggest pushing on an exercise with reported discomfort', async () => {
    await seedProfile();
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    for (let index = 0; index < 3; index += 1) {
      const sessionId = await engine.startSession({
        operationId: createId(),
        title: 'Тренировка',
        programDayId: null,
        exercises: [{ exerciseId: 'dead-bug', plannedSets: 1, repsMin: 8, repsMax: 12 }],
      });
      const session = await engine.getSession(sessionId);
      await engine.logSet(session!.exercises[0].id, { weightKg: 10, reps: 8, rir: null }, createId());
      if (index === 2) {
        await engine.reportDiscomfort(session!.exercises[0].id, createId());
      }
      await engine.completeSession(sessionId, createId());
    }
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');

    await testRouter.navigate('/coach');

    await screen.findByText('Регулярность');
    expect(screen.queryByText('Мёртвый жук')).toBeNull();
  });

  it('shows the pause when the app returns to an abandoned workout', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });

    await database.run('UPDATE workout_session SET last_activity_at = ?', ['2020-01-01T00:00:00.000Z']);
    await returnToApp();

    expect(await screen.findByRole('button', { name: 'Продолжить' })).toBeTruthy();
  });

  it('shows the real state after an action that came too late', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
    await database.run("UPDATE workout_session SET state = 'paused', paused_at = ?", [new Date().toISOString()]);

    await press('Пауза');

    expect(await screen.findByText(/Состояние тренировки уже изменилось/)).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Продолжить' })).toBeTruthy();
  });

  it('stops promising today\'s workout once it is done', async () => {
    const today = new Date().getDay();
    await completeOnboarding(
      database,
      { ...profile, trainingDays: [today] },
      generatePlan(profile),
      createId,
      new Date(),
    );
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Тренировка',
      programDayId: null,
      exercises: [{ exerciseId: 'dead-bug', plannedSets: 1, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    await engine.logSet(session!.exercises[0].id, { weightKg: 0, reps: 8, rir: null }, createId());
    await engine.completeSession(sessionId, createId());

    await renderRouter('./src/app');

    expect(await screen.findByText('Следующая тренировка')).toBeTruthy();
    expect(screen.queryByText('Сегодня по плану')).toBeNull();
  });

  it('shows local insights and says they are not AI', async () => {
    await seedOpenWorkout();
    await database.run(
      `UPDATE workout_session SET state = 'completed', paused_at = NULL, finished_at = ?`,
      [new Date().toISOString()],
    );
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');

    await testRouter.navigate('/coach');

    expect(await screen.findByText('Регулярность')).toBeTruthy();
    expect(screen.getByText(/Это не чат и не ИИ/)).toBeTruthy();
  });

  it('offers a way back to an open workout from other tabs', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app');
    await screen.findByText('Тренировка была прервана');

    await testRouter.navigate('/progress');
    await screen.findByRole('button', { name: 'Вернуться к тренировке' });

    await press('Вернуться к тренировке');

    expect(screen).toHavePathname('/workout');
  });
});

describe('set details', () => {
  it('prefills the planned reps for the first set and records a warm-up with a note', async () => {
    await seedProfile();
    const [day] = await getProgram(database);
    const planned = day.exercises[0];
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: day.name,
      programDayId: day.id,
      exercises: [
        {
          exerciseId: planned.exerciseId,
          plannedSets: planned.targetSets,
          repsMin: planned.repsMin,
          repsMax: planned.repsMax,
        },
      ],
    });
    const session = await engine.getSession(sessionId);
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
    await testRouter.push(`/workout/${session!.exercises[0].id}`);
    await screen.findByText('Записать подход');

    expect(screen.getByLabelText('Повторы').props.value).toBe(String(planned.repsMin));

    await type('Вес, кг', '40');
    await press('Разминка', 'radio');
    await type('Заметка', 'Лёгко');
    await press('Записать подход');

    expect(await screen.findByText('1. Разминка: 40 кг × 8. Лёгко')).toBeTruthy();
  });

  it('starts and stops the rest timer', async () => {
    await seedOpenWorkout();
    const exercise = await database.first<{ id: string }>(
      'SELECT id FROM session_exercise ORDER BY position LIMIT 1',
    );
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
    await testRouter.push(`/workout/${exercise!.id}`);
    await screen.findByText('Отдых');

    await press('1:30', 'radio');
    expect(await screen.findByRole('button', { name: 'Пропустить отдых' })).toBeTruthy();

    await press('Пропустить отдых');
    expect(screen.queryByRole('button', { name: 'Пропустить отдых' })).toBeNull();
  });
});

describe('set table', () => {
  async function openTable(exercises: ExerciseStart[], lastTime?: { weightKg: number; reps: number }) {
    await seedProfile();
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    if (lastTime) {
      const earlier = await engine.startSession({ operationId: createId(), title: 'Прошлая', programDayId: null, exercises });
      const session = await engine.getSession(earlier);
      await engine.logSet(session!.exercises[0].id, { ...lastTime, rir: 2 }, createId());
      await engine.logSet(session!.exercises[0].id, { ...lastTime, rir: 2 }, createId());
      await engine.completeSession(earlier, createId());
      await database.run('UPDATE workout_session SET started_at = ?, finished_at = ? WHERE id = ?', [
        '2026-01-05T10:00:00.000Z',
        '2026-01-05T11:00:00.000Z',
        earlier,
      ]);
    }
    const sessionId = await engine.startSession({ operationId: createId(), title: 'Сегодня', programDayId: null, exercises });
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
    return { engine, session: (await engine.getSession(sessionId))! };
  }

  const bench = { exerciseId: 'bench-press', plannedSets: 2, repsMin: 8, repsMax: 12 };
  const row = { exerciseId: 'dumbbell-row', plannedSets: 2, repsMin: 8, repsMax: 12 };
  const setsInDatabase = () => database.all('SELECT weight_kg, reps, kind FROM workout_set WHERE session_exercise_id IN (SELECT session_exercise.id FROM session_exercise JOIN workout_session ON workout_session.id = session_id WHERE state != ?) ORDER BY position', ['completed']);

  it('repeats last time with one tap on the check', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });

    await press('Записать подход 1');

    expect(await screen.findByRole('button', { name: 'Отменить подход 1' })).toBeTruthy();
    expect(await setsInDatabase()).toEqual([{ weight_kg: 60, reps: 10, kind: 'working' }]);
  });

  it('uses the set above once today differs from last time', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });

    await type('Подход 1, вес', '65');
    await press('Записать подход 1');
    await screen.findByRole('button', { name: 'Отменить подход 1' });
    await press('Записать подход 2');
    await screen.findByRole('button', { name: 'Отменить подход 2' });

    expect(await setsInDatabase()).toEqual([
      { weight_kg: 65, reps: 10, kind: 'working' },
      { weight_kg: 65, reps: 10, kind: 'working' },
    ]);
  });

  it('asks for the weight of a loaded exercise done for the first time', async () => {
    await openTable([bench]);

    await press('Записать подход 1');

    expect(await screen.findByText(/Укажите вес/)).toBeTruthy();
    expect(await setsInDatabase()).toEqual([]);

    await type('Подход 1, вес', '40');
    await press('Записать подход 1');

    expect(await screen.findByRole('button', { name: 'Отменить подход 1' })).toBeTruthy();
    expect(screen.queryByText(/Укажите вес/)).toBeNull();
    expect(await setsInDatabase()).toEqual([{ weight_kg: 40, reps: 8, kind: 'working' }]);
  });

  it('lets a bodyweight exercise go without a weight', async () => {
    await openTable([{ exerciseId: 'push-up', plannedSets: 2, repsMin: 8, repsMax: 12 }]);

    await press('Записать подход 1');

    await screen.findByRole('button', { name: 'Отменить подход 1' });
    expect(await setsInDatabase()).toEqual([{ weight_kg: null, reps: 8, kind: 'working' }]);
  });

  it('starts the rest by itself and takes it back with the set', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });

    await press('Записать подход 1');

    expect(await screen.findByRole('button', { name: 'Пропустить отдых' })).toBeTruthy();

    await press('Отменить подход 1');

    expect(await screen.findByRole('button', { name: 'Записать подход 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Пропустить отдых' })).toBeNull();
    expect(await setsInDatabase()).toEqual([]);
  });

  it('keeps the typed values after the check is undone', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });

    await type('Подход 1, вес', '72,5');
    await press('Записать подход 1');
    await press('Отменить подход 1');
    await screen.findByRole('button', { name: 'Записать подход 1' });

    expect(screen.getByLabelText('Подход 1, вес').props.value).toBe('72,5');
  });

  it('skips the rest after a warm-up set', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });

    await press(/^Подход 1, Рабочий/);
    await press('Записать подход 1');

    await screen.findByRole('button', { name: 'Отменить подход 1' });
    expect(await setsInDatabase()).toEqual([{ weight_kg: 60, reps: 10, kind: 'warmup' }]);
    expect(screen.queryByRole('button', { name: 'Пропустить отдых' })).toBeNull();
  });

  it('rests after the last exercise of a superset round only', async () => {
    const { engine, session } = await openTable([bench, row]);
    await engine.linkWithNext(session.exercises[0].id, createId());
    await testRouter.push(`/workout/${session.exercises[0].id}`);
    await screen.findByText('Суперсет: 1 из 2');
    await testRouter.back();
    await screen.findAllByText(/^Суперсет, /);

    await act(async () => {
      await fireEvent.changeText(screen.getAllByLabelText('Подход 1, вес')[0], '40');
    });
    await press('Записать подход 1');
    await screen.findByRole('button', { name: 'Отменить подход 1' });

    expect(screen.queryByRole('button', { name: 'Пропустить отдых' })).toBeNull();

    await act(async () => {
      await fireEvent.changeText(screen.getAllByLabelText('Подход 1, вес')[1], '20');
    });
    await press('Записать подход 1');

    expect(await screen.findByRole('button', { name: 'Пропустить отдых' })).toBeTruthy();
  });

  it('respects a switched-off automatic rest', async () => {
    await seedProfile();
    await database.run("INSERT INTO settings (key, value, updated_at) VALUES ('rest_auto', 'off', '2026-01-01')");
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    await engine.startSession({ operationId: createId(), title: 'Сегодня', programDayId: null, exercises: [{ exerciseId: 'push-up', plannedSets: 1, repsMin: 8, repsMax: 12 }] });
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });

    await press('Записать подход 1');

    await screen.findByRole('button', { name: 'Отменить подход 1' });
    expect(screen.queryByRole('button', { name: 'Пропустить отдых' })).toBeNull();
  });

  it('saves a change to a recorded set when the field is left', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });
    await press('Записать подход 1');
    await screen.findByRole('button', { name: 'Отменить подход 1' });

    await type('Подход 1, повторы', '12');
    await act(async () => {
      await fireEvent(screen.getByLabelText('Подход 1, повторы'), 'endEditing');
    });

    await waitFor(async () => {
      expect(await setsInDatabase()).toEqual([{ weight_kg: 60, reps: 12, kind: 'working' }]);
    });
  });

  it('refuses an impossible change and keeps the record', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });
    await press('Записать подход 1');
    await screen.findByRole('button', { name: 'Отменить подход 1' });

    await type('Подход 1, повторы', '0');
    await act(async () => {
      await fireEvent(screen.getByLabelText('Подход 1, повторы'), 'endEditing');
    });

    expect(await screen.findByText(/Проверьте значения/)).toBeTruthy();
    expect(await setsInDatabase()).toEqual([{ weight_kg: 60, reps: 10, kind: 'working' }]);
  });

  it('shows a change made on the exercise screen', async () => {
    const { session } = await openTable([bench], { weightKg: 60, reps: 10 });
    await press('Записать подход 1');
    await screen.findByRole('button', { name: 'Отменить подход 1' });
    await testRouter.push(`/workout/${session.exercises[0].id}`);
    await press('Изменить');
    await type('Вес, кг', '61');
    await press('Сохранить изменения');
    await screen.findByText(/^1\. 61 кг/);

    await testRouter.back();

    await waitFor(() => {
      expect(screen.getByLabelText('Подход 1, вес').props.value).toBe('61');
    });
  });

  it('records the suggested weight only after it is taken', async () => {
    const strong = { weightKg: 80, reps: 12 };
    await openTable([{ ...bench, repsMin: 8, repsMax: 12 }], strong);
    const suggestion = await screen.findByText(/Можно прибавить: 82,5 кг × 8/);
    expect(screen.getByLabelText('Подход 1, вес').props.placeholder).toBe('80');

    await act(async () => {
      await fireEvent.press(suggestion);
    });

    expect(screen.getByLabelText('Подход 1, вес').props.placeholder).toBe('82,5');
    await press('Записать подход 1');
    await screen.findByRole('button', { name: 'Отменить подход 1' });
    expect(await setsInDatabase()).toEqual([{ weight_kg: 82.5, reps: 8, kind: 'working' }]);
  });

  it('keeps the entered values and retries a failed save with the same operation', async () => {
    await openTable([bench], { weightKg: 60, reps: 10 });
    const logSet = jest
      .spyOn(WorkoutEngine.prototype, 'logSet')
      .mockRejectedValueOnce(new Error('database or disk is full'));

    await type('Подход 1, вес', '50');
    await press('Записать подход 1');

    expect(await screen.findByText(/Подход не сохранён.*закончилось место/)).toBeTruthy();
    expect(screen.getByLabelText('Подход 1, вес').props.value).toBe('50');
    expect(screen.queryByRole('button', { name: 'Пропустить отдых' })).toBeNull();

    await press('Записать подход 1');

    await screen.findByRole('button', { name: 'Отменить подход 1' });
    expect(logSet.mock.calls[0][2]).toBe(logSet.mock.calls[1][2]);
  });

  it('adds a row on request and always offers one in a free workout', async () => {
    await openTable([{ exerciseId: 'push-up', plannedSets: null, repsMin: null, repsMax: null }]);

    await type('Подход 1, повторы', '15');
    await press('Записать подход 1');

    expect(await screen.findByRole('button', { name: 'Записать подход 2' })).toBeTruthy();

    await press('Добавить подход');

    expect(screen.getByRole('button', { name: 'Записать подход 3' })).toBeTruthy();
  });

  it('locks the table during a pause', async () => {
    await seedOpenWorkout();
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });

    expect(screen.getAllByRole('button', { name: 'Записать подход 2', disabled: true }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Добавить подход' })).toBeNull();
    expect(screen.getByText(/Тренировка была прервана/)).toBeTruthy();
  });

  it('celebrates a beaten record and stops the rest when the workout ends', async () => {
    const { session } = await openTable([bench], { weightKg: 60, reps: 10 });
    await type('Подход 1, вес', '70');
    await press('Записать подход 1');
    await screen.findByRole('button', { name: 'Пропустить отдых' });

    await press('Завершить тренировку');

        expect(await screen.findByText('Новые рекорды')).toBeTruthy();
    expect(screen.getByText('Было 60 кг')).toBeTruthy();
    expect(screen.getByText('70 кг')).toBeTruthy();
    expect(screen).toHavePathname(`/history/${session.id}`);
    expect(screen.queryByRole('button', { name: 'Пропустить отдых' })).toBeNull();
  });
});

describe('home and progress overview', () => {
  async function finishFirstExercise() {
    const engine = await seedOpenWorkout();
    const open = await engine.getOpenSession();
    await engine.completeSession(open!.id, createId());
  }

  it('shows the plan for today and an empty week to a new user', async () => {
    await seedProfile();
    await renderRouter('./src/app');

    expect(await screen.findByRole('button', { name: 'Начать тренировку' })).toBeTruthy();
    expect(screen.getByText(/^\d+ упражнени/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Калории: 0 ккал' })).toBeTruthy();
    expect(screen.getByLabelText('Тренировок на этой неделе: 0')).toBeTruthy();
    expect(screen.queryByText('Недавняя нагрузка')).toBeNull();
  });

  it('marks the finished workout on the week and shows what was trained', async () => {
    await finishFirstExercise();
    await database.run('UPDATE workout_set SET position = position');
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    const [day] = await getProgram(database);
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: day.name,
      programDayId: day.id,
      exercises: [{ exerciseId: 'bench-press', plannedSets: 4, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    for (let set = 0; set < 4; set += 1) {
      await engine.logSet(session!.exercises[0].id, { weightKg: 60, reps: 10, rir: 2 }, createId());
    }
    await engine.completeSession(sessionId, createId());
    await renderRouter('./src/app');

    expect(await screen.findByText('Недавняя нагрузка')).toBeTruthy();
    expect(screen.getByLabelText(/^Недавно нагружены: .*грудные/)).toBeTruthy();
    expect(screen.getByLabelText(/^Тренировок на этой неделе: [12]$/)).toBeTruthy();
  });

  it('opens the body weight screen from its row', async () => {
    await seedProfile();
    await renderRouter('./src/app');
    await screen.findByRole('button', { name: 'Начать тренировку' });

    await press('Вес тела');

    expect(screen).toHavePathname('/body-weight');
  });

  it('switches the progress sections', async () => {
    await finishFirstExercise();
    await renderRouter('./src/app', { initialUrl: '/progress' });

    expect(await screen.findByLabelText('Дней с тренировками: 1')).toBeTruthy();
    expect(screen.queryByText('60 кг × 10')).toBeNull();

    await press('Рекорды', 'tab');
    expect(screen.getByText('60 кг × 10')).toBeTruthy();
    expect(screen.queryByLabelText('Дней с тренировками: 1')).toBeNull();

    await press('История', 'tab');
    expect(screen.getByText(/1 подход, 600 кг/)).toBeTruthy();
  });
});

describe('profile settings', () => {
  it('stores the automatic rest choice and opens the data screen', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Отдых сам после подхода');

    await act(async () => {
      await fireEvent(screen.getByLabelText('Отдых сам после подхода'), 'valueChange', false);
    });

    expect(await database.first("SELECT value FROM settings WHERE key = 'rest_auto'")).toEqual({ value: 'off' });

    await press('Ваши данные');

    expect(screen).toHavePathname('/data');
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
    await screen.findByRole('button', { name: 'Новый продукт' });
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
    expect(await screen.findByRole('button', { name: 'Калории: 183 ккал' })).toBeTruthy();
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

    expect(await screen.findByText(/Заполните все поля на 100 г/)).toBeTruthy();
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

  it('follows the calendar when the app returns the next day', async () => {
    await openDiary();
    await addOats();
    await screen.findByText('50 г, 183 ккал');

    moveClock(1);
    await returnToApp();

    await waitFor(() => {
      expect(screen.queryByText('50 г, 183 ккал')).toBeNull();
    });
    expect(screen.getByText('Сегодня')).toBeTruthy();

    await press('Предыдущий день');

    expect(await screen.findByText('50 г, 183 ккал')).toBeTruthy();
    expect(screen.getByText('Вчера')).toBeTruthy();
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

describe('workout depth', () => {
  async function openSession(exercises: Parameters<WorkoutEngine['startSession']>[0]['exercises']) {
    await seedProfile();
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Тест',
      programDayId: null,
      exercises,
    });
    await engine.pauseSession(sessionId, createId());
    await engine.resumeSession(sessionId, createId());
    return { engine, sessionId, session: (await engine.getSession(sessionId))! };
  }

  async function resumeOnOverview() {
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
  }

  it('links exercises into a superset and walks between them', async () => {
    const { session } = await openSession([
      { exerciseId: 'bench-press', plannedSets: 3, repsMin: 8, repsMax: 12 },
      { exerciseId: 'dumbbell-row', plannedSets: 3, repsMin: 8, repsMax: 12 },
    ]);
    await resumeOnOverview();

    await testRouter.push(`/workout/${session.exercises[0].id}`);
    await press(/^Объединить со следующим/);

    expect(await screen.findByText('Суперсет: 1 из 2')).toBeTruthy();
    await press('Дальше: Тяга гантели в наклоне');
    expect(await screen.findByText('Суперсет: 2 из 2')).toBeTruthy();

    await testRouter.back();

    expect(await screen.findAllByText(/^Суперсет, /)).toHaveLength(2);
  });

  it('records a cardio session in minutes and kilometres', async () => {
    const { session } = await openSession([
      { exerciseId: 'walking', plannedSets: 1, repsMin: null, repsMax: null, targetDurationSec: 900 },
    ]);
    await resumeOnOverview();
    await testRouter.push(`/workout/${session.exercises[0].id}`);
    await screen.findByLabelText('Время, мин');

    expect(screen.getByText('План: 1 × 15 мин')).toBeTruthy();
    expect(screen.getByLabelText('Время, мин').props.value).toBe('15');
    await type('Дистанция, км', '1,5');
    await press('Записать подход');

    expect(await screen.findByText('1. 15 мин, 1,5 км')).toBeTruthy();
    expect(await database.all('SELECT reps, duration_sec, distance_m FROM workout_set')).toEqual([
      { reps: null, duration_sec: 900, distance_m: 1500 },
    ]);
  });

  async function finishedWorkout() {
    const { engine, session, sessionId } = await openSession([
      { exerciseId: 'bench-press', plannedSets: 2, repsMin: 8, repsMax: 12 },
    ]);
    await engine.logSet(session.exercises[0].id, { weightKg: 60, reps: 10, rir: 2 }, createId());
    await engine.logSet(session.exercises[0].id, { weightKg: 60, reps: 9, rir: 1 }, createId());
    await engine.completeSession(sessionId, createId());
    return sessionId;
  }

  it('corrects a mistake in a finished workout', async () => {
    const sessionId = await finishedWorkout();
    await renderRouter('./src/app', { initialUrl: `/history/${sessionId}` });
    await screen.findByText('1. 60 кг × 10, запас 2');

    await press('1. 60 кг × 10, запас 2');
    await screen.findByLabelText('Вес, кг');
    await type('Вес, кг', '65');
    await press('Сохранить исправление');

    expect(await screen.findByText('1. 65 кг × 10, запас 2')).toBeTruthy();
  });

  it('repeats a past workout with its exercises', async () => {
    const sessionId = await finishedWorkout();
    await renderRouter('./src/app', { initialUrl: `/history/${sessionId}` });
    await screen.findByText('1. 60 кг × 10, запас 2');

    await press('Повторить тренировку');

    expect(await screen.findByText('Жим штанги лёжа')).toBeTruthy();
    const open = await database.first<{ state: string }>(
      "SELECT state FROM workout_session WHERE state = 'active'",
    );
    expect(open?.state).toBe('active');
  });

  it('shows a rest recommendation for the exercise', async () => {
    const { session } = await openSession([
      { exerciseId: 'lateral-raise', plannedSets: 3, repsMin: 10, repsMax: 15 },
    ]);
    await resumeOnOverview();
    await testRouter.push(`/workout/${session.exercises[0].id}`);

    expect(await screen.findByText(/обычно хватает 1:15/)).toBeTruthy();
  });
});

describe('coach and recovery', () => {
  async function reportPain() {
    await seedProfile();
    const [day] = await getProgram(database);
    const exerciseId = day.exercises[0].exerciseId;
    const engine = new WorkoutEngine({ database, createId, now: () => new Date() });
    const sessionId = await engine.startSession({
      operationId: createId(),
      title: 'Тест',
      programDayId: null,
      exercises: [{ exerciseId, plannedSets: 1, repsMin: 8, repsMax: 12 }],
    });
    const session = await engine.getSession(sessionId);
    await engine.logSet(session!.exercises[0].id, { weightKg: 40, reps: 8, rir: 2 }, createId());
    await engine.reportDiscomfort(session!.exercises[0].id, createId());
    await engine.completeSession(sessionId, createId());
    return exerciseId;
  }

  async function openCoach() {
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/coach');
    await screen.findByText('Отчёт за неделю');
  }

  it('asks before changing the plan and applies an accepted proposal', async () => {
    const exerciseId = await reportPain();
    await openCoach();

    expect(screen.getAllByText(/Было: /).length).toBeGreaterThan(0);
    expect((await getProgram(database))[0].exercises[0].exerciseId).toBe(exerciseId);

    await press(/^Принять: /);

    await screen.findByText('Отчёт за неделю');
    expect((await getProgram(database))[0].exercises[0].exerciseId).not.toBe(exerciseId);
  });

  it('undoes an accepted proposal from the history of decisions', async () => {
    const exerciseId = await reportPain();
    await openCoach();
    await press(/^Принять: /);
    await screen.findByText('Отчёт за неделю');

    await press('История решений');
    await screen.findByText('Решения');
    await press(/^Отменить решение/);

    await screen.findByText(/^Отменено/);
    expect((await getProgram(database))[0].exercises[0].exerciseId).toBe(exerciseId);
  });

  it('keeps the plan when a proposal is rejected', async () => {
    const exerciseId = await reportPain();
    await openCoach();

    const before = screen.getAllByText(/Было: /).length;

    await press(/^Отклонить: /);

    await screen.findByText('Отчёт за неделю');
    expect(screen.queryAllByText(/Было: /).length).toBeLessThan(before);
    expect((await getProgram(database))[0].exercises[0].exerciseId).toBe(exerciseId);
  });

  it('saves a check-in and shows readiness on the home screen', async () => {
    await seedProfile();
    await renderRouter('./src/app');
    await screen.findByRole('button', { name: 'Отметить сон и самочувствие' });
    await press('Отметить сон и самочувствие');
    await screen.findByLabelText('Сон, часов');

    await type('Сон, часов', '8');
    await press('Сохранить отметку');

    expect(await screen.findByText('Изменить отметку')).toBeTruthy();
    expect(await database.first('SELECT sleep_hours FROM daily_checkin')).toEqual({ sleep_hours: 8 });
  });

  it('remembers an edit in coach memory', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/coach/memory' });
    await screen.findByLabelText('Новая запись');

    await type('Новая запись', 'Тренируюсь по утрам');
    await press('Добавить запись');

    expect(await screen.findByLabelText('Запись')).toBeTruthy();
    expect(await database.first('SELECT text FROM coach_memory')).toEqual({ text: 'Тренируюсь по утрам' });
  });
});

describe('nutrition depth', () => {
  async function openAddFood() {
    await seedProfile();
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/nutrition');
    await screen.findByRole('button', { name: 'Добавить: Завтрак' });
    await press('Добавить: Завтрак');
    await screen.findByLabelText('Найти продукт');
  }

  it('finds a typical food in the base and offers its portion', async () => {
    await openAddFood();

    await type('Найти продукт', 'яйцо');
    await press(/^Яйцо куриное/);
    await act(async () => {
      await fireEvent.press(screen.getByText('1 штука, 55 г'));
    });

    expect(screen.getByLabelText('Вес порции, г').props.value).toBe('55');
    expect(screen.getByText(/Типовые значения/)).toBeTruthy();

    await press('Записать');

    expect(await screen.findByText('55 г, 79 ккал')).toBeTruthy();
    expect(await database.first('SELECT source FROM food')).toEqual({ source: 'catalog' });
  });

  it('hides meat from a vegetarian', async () => {
    await completeOnboarding(database, { ...profile, diet: 'vegetarian' }, generatePlan(profile), createId, new Date());
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/nutrition');
    await screen.findByRole('button', { name: 'Добавить: Завтрак' });
    await press('Добавить: Завтрак');
    await screen.findByLabelText('Найти продукт');

    await type('Найти продукт', 'куриная грудка');

    expect(screen.queryByText(/^Куриная грудка/)).toBeNull();
    expect(screen.getByText(/Ничего не найдено/)).toBeTruthy();
  });

  it('remembers what a meal usually contains and prefills the portion', async () => {
    await seedProfile();
    const today = dayKey(new Date());
    await logFood(database, {
      entryId: 'e1',
      foodId: 'f1',
      name: 'Творог',
      per100g: { kcal: 120, protein: 17, fat: 5, carbs: 3 },
      grams: 200,
      day: shiftDay(today, -1),
      meal: 'breakfast',
      now: new Date(),
    });
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/nutrition');
    await screen.findByRole('button', { name: 'Добавить: Завтрак' });
    await press('Добавить: Завтрак');

    expect(await screen.findByText('Обычно на завтрак')).toBeTruthy();
    await press(/^Творог/);

    expect(screen.getByLabelText('Вес порции, г').props.value).toBe('200');
  });

  it('copies the previous day on request', async () => {
    await seedProfile();
    const today = dayKey(new Date());
    await logFood(database, {
      entryId: 'e1',
      foodId: 'f1',
      name: 'Овсянка',
      per100g: { kcal: 366, protein: 12, fat: 6, carbs: 62 },
      grams: 50,
      day: shiftDay(today, -1),
      meal: 'breakfast',
      now: new Date(),
    });
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/nutrition');

    await screen.findByRole('button', { name: 'Скопировать записи предыдущего дня' });
    await press('Скопировать записи предыдущего дня');

    expect(await screen.findByText('50 г, 183 ккал')).toBeTruthy();
    expect(await database.all('SELECT day FROM food_entry WHERE day = ?', [today])).toHaveLength(1);
  });

  it('shows calculated targets once the body data is known', async () => {
    await completeOnboarding(
      database,
      { ...profile, sex: 'male', heightCm: 180, activityLevel: 'moderate' },
      generatePlan(profile),
      createId,
      new Date(),
    );
    await renderRouter('./src/app');
    await screen.findByText('Следующая тренировка');
    await testRouter.navigate('/nutrition');

    expect(await screen.findByText(/^ккал осталось/)).toBeTruthy();

    await press('Цели по питанию');
    await screen.findByLabelText('Калории в день');
    await type('Калории в день', '2000');
    await press('Сохранить свои цели');

    expect(await screen.findByText(/^2\s?000$/)).toBeTruthy();
    expect(await getManualTarget(database)).toMatchObject({ kcal: 2000 });
  });

  it('asks for body data before calculating targets', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/nutrition-targets' });

    expect(await screen.findByText(/Для расчёта нужны вес, рост и активность/)).toBeTruthy();
  });

  it('builds a dish from products and offers it later', async () => {
    await openAddFood();
    await press('Блюдо из продуктов');
    await screen.findByLabelText('Название блюда');

    await type('Название блюда', 'Каша');
    await type('Найти продукт', 'овсяные');
    await press(/^Овсяные хлопья, сухие/);
    await type('Вес продукта, г', '100');
    await press('Добавить в блюдо');
    await type('Вес готового блюда, г', '300');
    await press('Сохранить блюдо');

    const dish = await database.first<{ kcal: number; source: string }>("SELECT kcal, source FROM food WHERE source = 'recipe'");
    expect(dish?.kcal).toBeCloseTo(122, 0);
    expect(await database.all('SELECT name FROM recipe_item')).toHaveLength(1);
  });

  it('prefills a scanned product and keeps its barcode', async () => {
    await seedProfile();
    await renderRouter('./src/app', {
      initialUrl: `/food/add?day=${dayKey(new Date())}&meal=snack&barcode=3017620422003&fromLookup=1&name=Nutella&kcal=539&protein=6.3&fat=30.9&carbs=57.5`,
    });

    expect(await screen.findByText(/Open Food Facts/)).toBeTruthy();
    expect(screen.getByLabelText('Название').props.value).toBe('Nutella');
    await type('Вес порции, г', '20');
    await press('Записать');

    expect(await database.first('SELECT barcode, source FROM food')).toEqual({
      barcode: '3017620422003',
      source: 'barcode',
    });
  });
});

describe('library, analytics and protection', () => {
  it('shows the exercise passport with muscles and alternatives', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/exercises/bench-press' });

    expect(await screen.findByText(/^Основные мышцы: Грудные/)).toBeTruthy();
    expect(screen.getByText(/^Помогают: /)).toBeTruthy();
    expect(screen.getByText('Чем заменить')).toBeTruthy();
    expect(screen.getByLabelText(/^Схема мышц/)).toBeTruthy();
  });

  it('remembers not to offer an exercise', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/exercises/burpee' });
    await screen.findByRole('button', { name: 'Не предлагать это упражнение' });

    await press('Не предлагать это упражнение');

    expect(await screen.findByRole('button', { name: 'Снова предлагать это упражнение' })).toBeTruthy();
    expect(await database.first('SELECT exercise_id FROM coach_memory')).toEqual({ exercise_id: 'burpee' });
  });

  it('filters the library by section', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/exercises' });
    await screen.findByLabelText('Найти упражнение');

    await act(async () => {
      await fireEvent.press(screen.getByText('Кардио'));
    });

    expect(await screen.findByText('Ходьба')).toBeTruthy();
    expect(screen.queryByText('Жим штанги лёжа')).toBeNull();
  });

  it('shows analytics with honest empty states', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/analytics' });

    expect(await screen.findByText('Появится после первой завершённой тренировки.')).toBeTruthy();
    expect(screen.getByText('Заполняйте дневник, и здесь появятся средние значения.')).toBeTruthy();
    expect(screen.getByText('Отмечайте сон на Главной, и здесь появится динамика.')).toBeTruthy();
  });

  it('asks for a longer password and passes a good one on', async () => {
    jest.mocked(shareBackup).mockResolvedValue(true);
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await type('Пароль для копии', 'коротко');
    await press('Сохранить резервную копию');
    expect(await screen.findByText(/Пароль должен быть не короче 8 символов/)).toBeTruthy();
    expect(shareBackup).not.toHaveBeenCalled();

    await type('Пароль для копии', 'достаточно длинный');
    await type('Повторите пароль', 'другой пароль тут');
    await press('Сохранить резервную копию');
    expect(await screen.findByText('Пароли не совпадают.')).toBeTruthy();
    expect(shareBackup).not.toHaveBeenCalled();

    await type('Повторите пароль', 'достаточно длинный');
    await press('Сохранить резервную копию');

    expect(shareBackup).toHaveBeenCalledWith(database, 'достаточно длинный');
  });

  it('opens an encrypted backup with its password', async () => {
    await seedProfile();
    const plain = await exportAllData(database);
    const locked = await encryptBackup(plain, 'верный пароль', (count) => new Uint8Array(count).fill(7), 10);
    await database.run("UPDATE profile SET name = 'Другое имя'");
    jest.mocked(pickBackup).mockResolvedValue(locked);
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Восстановить из копии');
    await screen.findByLabelText('Пароль от копии');
    await type('Пароль от копии', 'неверный пароль');
    await press('Открыть копию');
    expect(await screen.findByText(/Пароль не подходит или файл копии повреждён/)).toBeTruthy();
    expect(await getProfile(database)).toMatchObject({ name: 'Другое имя' });

    await type('Пароль от копии', 'верный пароль');
    await press('Открыть копию');

    expect(await screen.findByText('Данные восстановлены из копии.')).toBeTruthy();
    expect(await getProfile(database)).toMatchObject({ name: 'Ислам' });
  });

  it('exports workouts as a table and reports it', async () => {
    jest.mocked(shareWorkoutsCsv).mockResolvedValue(true);
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/data' });
    await screen.findByText('Резервная копия');

    await press('Экспорт тренировок в таблицу');

    expect(await screen.findByText(/^Таблица тренировок передана/)).toBeTruthy();
  });

  it('turns the rest sound off', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/profile' });
    await screen.findByText('Звук окончания отдыха');

    await act(async () => {
      await fireEvent(screen.getByLabelText('Звук окончания отдыха'), 'valueChange', false);
    });

    expect(await database.first("SELECT value FROM settings WHERE key = 'sound'")).toEqual({ value: 'off' });
  });

  it('states what the app is and what leaves the phone', async () => {
    await seedProfile();
    await renderRouter('./src/app', { initialUrl: '/about' });

    expect(await screen.findByText(/не диагностирует, не лечит/)).toBeTruthy();
    expect(screen.getByText(/При сканировании номер штрихкода отправляется/)).toBeTruthy();
  });
});

describe('failures', () => {
  it('keeps the entered values and retries a failed save exactly once', async () => {
    await seedOpenWorkout();
    const exercise = await database.first<{ id: string }>(
      'SELECT id FROM session_exercise ORDER BY position LIMIT 1 OFFSET 1',
    );
    await renderRouter('./src/app', { initialUrl: '/workout' });
    await screen.findByRole('button', { name: 'Продолжить' });
    await press('Продолжить');
    await screen.findByRole('button', { name: 'Пауза' });
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
