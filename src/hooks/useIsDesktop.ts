import { useState, useEffect } from 'react';

export function useIsDesktop(breakpoint = 1080): boolean {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return true;
    return window.innerWidth > breakpoint;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia(`(min-width: ${breakpoint + 1}px)`);
    const update = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsDesktop(e.matches);
    };

    setIsDesktop(mediaQuery.matches);

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', update);
      return () => mediaQuery.removeEventListener('change', update);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(update);
      return () => mediaQuery.removeListener(update);
    }
  }, [breakpoint]);

  return isDesktop;
}
