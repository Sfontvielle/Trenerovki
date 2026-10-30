import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter, screen, testRouter } from 'expo-router/testing-library';

const tabs = [
  { path: '/', title: 'Главная' },
  { path: '/workouts', title: 'Тренировки' },
  { path: '/coach', title: 'Coach' },
  { path: '/nutrition', title: 'Питание' },
  { path: '/progress', title: 'Прогресс' },
] as const;

async function press(name: string) {
  await act(async () => {
    await fireEvent.press(screen.getAllByRole('button', { name })[0]);
  });
}

describe('app routes', () => {
  it('opens the home tab at the root route', async () => {
    await renderRouter('./src/app');

    expect(screen).toHavePathname('/');
    expect(screen.getByRole('header', { name: 'Главная' })).toBeTruthy();
  });

  it.each(tabs)('opens the $title tab and marks it as unfinished', async ({ path, title }) => {
    await renderRouter('./src/app');

    await testRouter.navigate(path);

    expect(screen).toHavePathname(path);
    expect(screen.getByRole('header', { name: title })).toBeTruthy();
    expect(screen.getAllByText('Раздел в разработке').length).toBeGreaterThan(0);
  });

  it('opens the profile from the avatar and closes it', async () => {
    await renderRouter('./src/app');

    await press('Открыть профиль');
    expect(screen).toHavePathname('/profile');

    await press('Закрыть');
    expect(screen).toHavePathname('/');
  });

  it('opens the design system preview from the profile', async () => {
    await renderRouter('./src/app');

    await press('Открыть профиль');
    await press('Открыть дизайн-систему');
    expect(screen).toHavePathname('/design-system');

    await press('Вернуться назад');
    expect(screen).toHavePathname('/profile');
  });
});
