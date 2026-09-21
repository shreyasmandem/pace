import { FileText } from 'lucide-react';
import { SiLeetcode, SiGeeksforgeeks, SiYoutube } from 'react-icons/si';
import type { IconType } from 'react-icons';
import type { ProblemLinks } from '../types';
import styles from './ResourceLinks.module.css';

interface ResourceDef {
  key: keyof ProblemLinks;
  label: string;
  icon?: IconType;
  monogram?: string;
  className: string;
}

const RESOURCES: ResourceDef[] = [
  { key: 'practice', label: 'Practice on takeUforward', monogram: 'F', className: styles.practice },
  { key: 'article', label: 'Read explanation', icon: FileText, className: styles.article },
  { key: 'youtube', label: 'Video lecture', icon: SiYoutube, className: styles.youtube },
  { key: 'leetcode', label: 'LeetCode', icon: SiLeetcode, className: styles.leetcode },
  { key: 'gfg', label: 'GeeksforGeeks', icon: SiGeeksforgeeks, className: styles.gfg },
  { key: 'neetcode', label: 'NeetCode video', monogram: 'N', className: styles.neetcode },
  { key: 'codestudio', label: 'Code360', monogram: 'C', className: styles.codestudio },
];

export default function ResourceLinks({ links }: { links: ProblemLinks }) {
  const active = RESOURCES.filter((r) => links[r.key]);
  if (active.length === 0) return null;

  return (
    <div className={styles.row}>
      {active.map((r) => (
        <a
          key={r.key}
          href={links[r.key]!}
          target="_blank"
          rel="noreferrer"
          className={`${styles.link} ${r.className}`}
          title={r.label}
          aria-label={r.label}
        >
          {r.icon ? <r.icon size={13} /> : <span className={styles.monogram}>{r.monogram}</span>}
        </a>
      ))}
    </div>
  );
}
