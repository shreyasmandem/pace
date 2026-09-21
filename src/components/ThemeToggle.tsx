import { Moon, Sun } from 'lucide-react';
import { usePaceStore } from '../state/store';
import { useResolvedTheme } from '../hooks/useTheme';
import styles from './Sidebar.module.css';

export default function ThemeToggle() {
  const setTheme = usePaceStore((s) => s.setTheme);
  const resolved = useResolvedTheme();

  return (
    <button
      className={styles.iconButton}
      onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
      aria-label={resolved === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {resolved === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
