import {
  type AccentName,
  type ColorMode,
  accentColors,
  baseColors,
  maxFontScale,
  motion,
  radii,
  shadowOpacity,
  sizes,
  spacing,
  statusColors,
  typography,
} from './tokens';

export type ThemePreference = 'system' | ColorMode;

export function resolveColorMode(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ColorMode {
  if (preference !== 'system') {
    return preference;
  }
  return systemScheme === 'light' ? 'light' : 'dark';
}

export function createTheme(mode: ColorMode, accent: AccentName, reduceMotion: boolean) {
  const base = baseColors[mode];
  const accentColor = accentColors[accent][mode];

  return {
    mode,
    accent,
    colors: {
      ...base,
      ...statusColors[mode],
      accent: accentColor.solid,
      accentSoft: `${accentColor.solid}${shadowOpacity.tint}`,
      onAccent: accentColor.onSolid,
    },
    shadows: {
      panel: mode === 'light' ? `0 2px 12px ${base.textPrimary}${shadowOpacity.soft}` : undefined,
      glow: `0 6px 24px ${accentColor.solid}${shadowOpacity.glow}`,
      selected: `0 0 14px ${accentColor.solid}${shadowOpacity.selected}`,
      ambient: `0 0 150px 110px ${accentColor.solid}${shadowOpacity.ambient}`,
      ambientSecond: `0 0 140px 90px ${accentColors.violet[mode].solid}${shadowOpacity.ambient}`,
    },
    motion: reduceMotion
      ? { fast: 0, normal: 0, slow: 0, pressScale: 1 }
      : motion,
    maxFontScale,
    radii,
    sizes,
    spacing,
    typography,
  };
}

export type Theme = ReturnType<typeof createTheme>;
