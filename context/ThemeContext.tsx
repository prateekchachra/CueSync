import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ThemeColors } from '@/constants/theme';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
};

const STORAGE_KEY = 'mysync.theme';
const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') setPreferenceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const value = useMemo<ThemeContextValue>(() => {
    const scheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return {
      colors: scheme === 'dark' ? darkColors : lightColors,
      preference,
      setPreference: (next) => {
        setPreferenceState(next);
        AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
      },
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

/** Memoised themed StyleSheet factory: `const styles = useStyles(makeStyles)`. */
export function useStyles<T>(factory: (c: ThemeColors) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
