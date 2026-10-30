import { act, fireEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';

describe('app routes', () => {
  it('opens the home screen at the root route', async () => {
    await renderRouter('./src/app');

    expect(screen).toHavePathname('/');
    expect(screen.getByText('IRONVANT')).toBeTruthy();
  });

  it('opens the design system preview and comes back', async () => {
    await renderRouter('./src/app');

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Открыть дизайн-систему' }));
    });
    expect(screen).toHavePathname('/design-system');

    await act(async () => {
      await fireEvent.press(screen.getByRole('button', { name: 'Вернуться назад' }));
    });
    expect(screen).toHavePathname('/');
  });
});
