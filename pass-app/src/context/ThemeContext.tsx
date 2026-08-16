import React, { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import { ThemeMode } from '../types';
import { palettes, Palette } from '../theme';
import { getTheme, setTheme as persistTheme } from '../lib/persist';

interface ThemeContextValue {
  theme: ThemeMode;
  c: Palette;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  c: palettes.light,
  toggleTheme: () => {},
  isDark: false,
});

export function usePalette() {
  return useContext(ThemeContext).c;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    getTheme().then((t) => {
      if (active) {
        setThemeState(t);
        setReady(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      persistTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      c: palettes[theme],
      toggleTheme,
      isDark: theme === 'dark',
    }),
    [theme, toggleTheme]
  );

  if (!ready) return null;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
