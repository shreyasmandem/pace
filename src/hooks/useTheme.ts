import { useEffect } from 'react';
import { usePaceStore } from '../state/store';

export function useThemeEffect() {
  const theme = usePaceStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);
}

export function useResolvedTheme(): 'light' | 'dark' {
  const theme = usePaceStore((s) => s.theme);
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}
