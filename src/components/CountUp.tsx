import { useEffect, useRef, useState } from 'react';

const DURATION_MS = 750;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export default function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0));
  const shownRef = useRef(shown);

  useEffect(() => {
    const from = shownRef.current;
    if (from === value || prefersReducedMotion()) {
      shownRef.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 4);
      const next = Math.round(from + (value - from) * eased);
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown}</>;
}
