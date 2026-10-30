import { render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/(tabs)/index';
import { DesignSystemProvider } from '@/design-system';

describe('HomeScreen', () => {
  it('shows the title and marks the section as unfinished', async () => {
    await render(<HomeScreen />, { wrapper: DesignSystemProvider });

    expect(screen.getByRole('header', { name: 'Главная' })).toBeTruthy();
    expect(screen.getByText('Раздел в разработке')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Открыть профиль' })).toBeTruthy();
  });
});
