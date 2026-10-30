import { renderRouter, screen } from 'expo-router/testing-library';

describe('app routes', () => {
  it('opens the home screen at the root route', async () => {
    await renderRouter('./src/app');

    expect(screen).toHavePathname('/');
    expect(screen.getByText('IRONVANT')).toBeTruthy();
  });
});
