import type { CSSProperties } from 'react';
import styles from './PaceRing.module.css';

interface PaceRingProps {
  percent: number;
  size?: number;
  label: string;
  value: string;
}

export default function PaceRing({ percent, size = 132, label, value }: PaceRingProps) {
  const stroke = size * 0.08;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className={styles.wrap} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-sunken)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={styles.progress}
          style={{ '--circumference': circumference } as CSSProperties}
        />
      </svg>
      <div className={styles.center}>
        <span className={`${styles.value} numeric`}>{value}</span>
        <span className={styles.label}>{label}</span>
      </div>
    </div>
  );
}
