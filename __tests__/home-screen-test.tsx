import { render, screen } from '@testing-library/react-native';

import HomeScreen from '@/app/index';
import { DesignSystemProvider } from '@/design-system';

describe('HomeScreen', () => {
  it('shows the product name and the scaffold notice', async () => {
    await render(<HomeScreen />, { wrapper: DesignSystemProvider });

    expect(screen.getByText('IRONVANT')).toBeTruthy();
    expect(screen.getByText(/Каркас приложения/)).toBeTruthy();
  });
});
