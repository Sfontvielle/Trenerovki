import type { TextStyle } from 'react-native';

export type ColorMode = 'dark' | 'light';

export const accentNames = ['cyan', 'violet', 'green', 'orange', 'rose'] as const;
export type AccentName = (typeof accentNames)[number];

type BaseColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  hairline: string;
  textPrimary: string;
  textSecondary: string;
};

type AccentColors = {
  solid: string;
  onSolid: string;
};

type StatusColors = {
  success: string;
  warning: string;
  danger: string;
  info: string;
};

export type StatusTone = keyof StatusColors;

export const baseColors: Record<ColorMode, BaseColors> = {
  dark: {
    background: '#090D1C',
    surface: '#172238',
    surfaceRaised: '#202D47',
    border: '#2C3A58',
    hairline: '#26324D',
    textPrimary: '#F2F5FA',
    textSecondary: '#A8B4C8',
  },
  light: {
    background: '#F4F6FA',
    surface: '#FFFFFF',
    surfaceRaised: '#E9EDF4',
    border: '#D5DCE7',
    hairline: '#E3E8EF',
    textPrimary: '#0E1526',
    textSecondary: '#4C5870',
  },
};

export const accentColors: Record<AccentName, Record<ColorMode, AccentColors>> = {
  cyan: {
    dark: { solid: '#22D3EE', onSolid: '#090D1C' },
    light: { solid: '#0E7490', onSolid: '#FFFFFF' },
  },
  violet: {
    dark: { solid: '#6478FF', onSolid: '#090D1C' },
    light: { solid: '#4A5BE0', onSolid: '#FFFFFF' },
  },
  green: {
    dark: { solid: '#34D399', onSolid: '#090D1C' },
    light: { solid: '#047857', onSolid: '#FFFFFF' },
  },
  orange: {
    dark: { solid: '#FB923C', onSolid: '#090D1C' },
    light: { solid: '#C2410C', onSolid: '#FFFFFF' },
  },
  rose: {
    dark: { solid: '#FB7185', onSolid: '#090D1C' },
    light: { solid: '#BE123C', onSolid: '#FFFFFF' },
  },
};

export const statusColors: Record<ColorMode, StatusColors> = {
  dark: {
    success: '#4ADE80',
    warning: '#FBBF24',
    danger: '#F87171',
    info: '#60A5FA',
  },
  light: {
    success: '#15803D',
    warning: '#A16207',
    danger: '#B91C1C',
    info: '#1D4ED8',
  },
};

export const spacing = {
  xs: 4,
  s: 8,
  m: 12,
  l: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  chip: 10,
  control: 14,
  panel: 20,
  sheet: 28,
  full: 999,
} as const;

export const sizes = {
  minTouch: 44,
  control: 52,
  swatch: 16,
  border: 1,
  coreInner: 88,
  coreOuter: 168,
  scannerHeight: 260,
  hairline: 0.5,
  icon: 20,
  chevron: 13,
  glyphScale: 0.9,
  rowMinHeight: 52,
  segment: 36,
  gauge: 92,
  setCell: 40,
  setNumber: 26,
  setCheck: 44,
  groupRail: 3,
  weekDot: 34,
  thumbnail: 44,
  chartHeight: 160,
  chartBar: 24,
  choiceMinHeight: 76,
  choiceTallHeight: 104,
  progressBar: 5,
  rulerHeight: 76,
  wheelRow: 44,
} as const;

export const maxFontScale = 1.6;

export const numeralFont = 'SofiaSansExtraCondensed_700Bold';

export const typography = {
  display: { fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 20, lineHeight: 25, fontWeight: '600' },
  body: { fontSize: 17, lineHeight: 24, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  scoreHero: { fontFamily: numeralFont, fontSize: 88, lineHeight: 90, fontVariant: ['tabular-nums'] },
  scoreLarge: { fontFamily: numeralFont, fontSize: 52, lineHeight: 54, fontVariant: ['tabular-nums'] },
  scoreMedium: { fontFamily: numeralFont, fontSize: 32, lineHeight: 34, fontVariant: ['tabular-nums'] },
  scoreSmall: { fontFamily: numeralFont, fontSize: 25, lineHeight: 28, fontVariant: ['tabular-nums'] },
  // No line height: on iOS it pushes the text off centre in a one-line field.
  scoreInput: { fontFamily: numeralFont, fontSize: 25, fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  fast: 120,
  normal: 220,
  slow: 420,
  pressScale: 0.98,
} as const;

export const shadowOpacity = {
  ambient: '1A',
  soft: '14',
  tint: '1F',
  selected: '59',
  glow: '66',
} as const;
