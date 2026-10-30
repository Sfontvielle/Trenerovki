import { createTheme, resolveColorMode } from '@/design-system/theme';
import { type ColorMode, accentNames, statusColors } from '@/design-system/tokens';

const modes: ColorMode[] = ['dark', 'light'];

function luminance(hex: string) {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r, g, b] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(first: string, second: string) {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('resolveColorMode', () => {
  it('uses the explicit preference over the system scheme', () => {
    expect(resolveColorMode('light', 'dark')).toBe('light');
    expect(resolveColorMode('dark', 'light')).toBe('dark');
  });

  it('follows the system scheme and falls back to dark', () => {
    expect(resolveColorMode('system', 'light')).toBe('light');
    expect(resolveColorMode('system', 'dark')).toBe('dark');
    expect(resolveColorMode('system', null)).toBe('dark');
  });
});

describe('createTheme', () => {
  it('keeps the approved Neural Performance colors in the dark theme', () => {
    expect(createTheme('dark', 'cyan', false).colors).toMatchObject({
      background: '#090D1C',
      surface: '#172238',
      accent: '#22D3EE',
    });
    expect(createTheme('dark', 'violet', false).colors.accent).toBe('#6478FF');
  });

  it('removes motion when Reduce Motion is on', () => {
    expect(createTheme('dark', 'cyan', true).motion).toEqual({
      fast: 0,
      normal: 0,
      slow: 0,
      pressScale: 1,
    });
  });

  it('keeps status colors independent of the accent', () => {
    for (const mode of modes) {
      for (const accent of accentNames) {
        const { colors } = createTheme(mode, accent, false);
        expect(colors).toMatchObject(statusColors[mode]);
        expect(Object.values(statusColors[mode])).not.toContain(colors.accent);
      }
    }
  });
});

describe.each(modes)('contrast in the %s theme', (mode) => {
  const { colors } = createTheme(mode, 'cyan', false);

  it.each(['background', 'surface', 'surfaceRaised'] as const)('keeps text readable on %s', (key) => {
    expect(contrast(colors.textPrimary, colors[key])).toBeGreaterThanOrEqual(7);
    expect(contrast(colors.textSecondary, colors[key])).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['success', 'warning', 'danger', 'info'] as const)('keeps %s readable', (key) => {
    expect(contrast(colors[key], colors.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors[key], colors.surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(accentNames)('keeps the %s accent readable', (accent) => {
    const themed = createTheme(mode, accent, false).colors;
    expect(contrast(themed.onAccent, themed.accent)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(themed.accent, themed.background)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(themed.accent, themed.surface)).toBeGreaterThanOrEqual(3);
  });
});
