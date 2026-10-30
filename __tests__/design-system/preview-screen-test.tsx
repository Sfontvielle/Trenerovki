import { render, screen, userEvent } from '@testing-library/react-native';

import DesignSystemScreen from '@/app/design-system';
import { DesignSystemProvider } from '@/design-system';

describe('DesignSystemScreen', () => {
  async function renderScreen() {
    await render(<DesignSystemScreen />, { wrapper: DesignSystemProvider });
  }

  it('switches between the dark and light themes', async () => {
    await renderScreen();

    await userEvent.press(screen.getByRole('radio', { name: 'Тёмная' }));
    expect(screen.getByText('Сейчас: тёмная тема')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Тёмная', checked: true })).toBeTruthy();

    await userEvent.press(screen.getByRole('radio', { name: 'Светлая' }));
    expect(screen.getByText('Сейчас: светлая тема')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Тёмная', checked: false })).toBeTruthy();
  });

  it('selects the accent', async () => {
    await renderScreen();

    await userEvent.press(screen.getByRole('radio', { name: 'Фиолетовый' }));

    expect(screen.getByRole('radio', { name: 'Фиолетовый', checked: true })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Голубой', checked: false })).toBeTruthy();
  });

  it('shows the loading state and returns from it', async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    await renderScreen();

    await user.press(screen.getByRole('button', { name: 'Показать загрузку' }));
    expect(screen.getByRole('button', { name: 'Загрузка', busy: true })).toBeTruthy();

    await jest.advanceTimersByTimeAsync(1500);
    expect(await screen.findByRole('button', { name: 'Показать загрузку' })).toBeTruthy();
    jest.useRealTimers();
  });
});
