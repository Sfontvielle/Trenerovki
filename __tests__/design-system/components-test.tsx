import { render, screen, userEvent } from '@testing-library/react-native';

import { Button, DesignSystemProvider } from '@/design-system';

const wrapper = DesignSystemProvider;

describe('Button', () => {
  it('calls onPress when active', async () => {
    const onPress = jest.fn();
    await render(<Button label="Сохранить подход" onPress={onPress} />, { wrapper });

    await userEvent.press(screen.getByRole('button', { name: 'Сохранить подход' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await render(<Button label="Сохранить подход" disabled onPress={onPress} />, { wrapper });

    await userEvent.press(screen.getByRole('button', { name: 'Сохранить подход' }));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { disabled: true })).toBeTruthy();
  });

  it('ignores presses and reports busy while loading', async () => {
    const onPress = jest.fn();
    await render(<Button label="Сохранить подход" loading onPress={onPress} />, { wrapper });

    await userEvent.press(screen.getByRole('button', { name: 'Сохранить подход' }));

    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { busy: true })).toBeTruthy();
  });
});
