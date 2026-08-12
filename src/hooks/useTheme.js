'use client';

import { useCallback, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'wave-theme';
const THEMES = ['light', 'dark', 'system'];

function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function useTheme() {
  const [theme, setThemeState] = useState('system');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const nextTheme = THEMES.includes(storedTheme) ? storedTheme : 'system';
    setThemeState(nextTheme);
  }, []);

  useEffect(() => {
    applyTheme(theme);
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (theme === 'system') applyTheme('system');
    };
    mediaQuery?.addEventListener?.('change', handleSystemThemeChange);
    return () => mediaQuery?.removeEventListener?.('change', handleSystemThemeChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    if (!THEMES.includes(nextTheme)) return;
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
    applyTheme(nextTheme);
  }, []);

  return { theme, setTheme };
}
