import { type PropsWithChildren, createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';

import { type Theme, type ThemePreference, createTheme, resolveColorMode } from './theme';
import type { AccentName } from './tokens';
import { useReduceMotion } from './use-reduce-motion';

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  setAccent: (accent: AccentName) => void;
  reduceMotion: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function DesignSystemProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const reduceMotion = useReduceMotion();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [accent, setAccent] = useState<AccentName>('cyan');
  const theme = createTheme(resolveColorMode(preference, systemScheme), accent, reduceMotion);

  return (
    <ThemeContext.Provider value={{ theme, preference, setPreference, setAccent, reduceMotion }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error('useTheme must be used inside DesignSystemProvider');
  }
  return value;
}
