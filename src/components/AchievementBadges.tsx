import { useMemo } from 'react';
import { Award } from 'lucide-react';
import styles from './AchievementBadges.module.css';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  current: number;
  target: number;
  unit?: string;
  unlocked: boolean;
}

export default function AchievementBadges({
  solvedCount = 0,
  streak = 0,
  maxStreak = 0,
  solveLog = {},
  userRank = null,
}: {
  solvedCount: number;
  streak: number;
  maxStreak: number;
  solveLog: Record<string, number>;
  userRank?: number | null;
}) {
  const maxInSingleDay = useMemo(() => {
    return Object.values(solveLog).reduce((max, n) => Math.max(max, n || 0), 0);
  }, [solveLog]);

  const achievements: Achievement[] = useMemo(() => {
    return [
      {
        id: 'first_blood',
        title: 'First Blood',
        description: 'Solve your very first DSA problem on Pace.',
        icon: '🚀',
        current: Math.min(solvedCount, 1),
        target: 1,
        unlocked: solvedCount >= 1,
      },
      {
        id: 'streak_novice',
        title: 'Streak Novice',
        description: 'Maintain an active solve streak for 3 consecutive days.',
        icon: '🔥',
        current: Math.min(Math.max(streak, maxStreak), 3),
        target: 3,
        unit: 'days',
        unlocked: Math.max(streak, maxStreak) >= 3,
      },
      {
        id: 'streak_warrior',
        title: 'Streak Warrior',
        description: 'Keep your momentum burning for 7 consecutive days.',
        icon: '⚡',
        current: Math.min(Math.max(streak, maxStreak), 7),
        target: 7,
        unit: 'days',
        unlocked: Math.max(streak, maxStreak) >= 7,
      },
      {
        id: 'speed_demon',
        title: 'Daily Blitz',
        description: 'Solve 5 or more problems in a single calendar day.',
        icon: '🎯',
        current: Math.min(maxInSingleDay, 5),
        target: 5,
        unit: 'problems',
        unlocked: maxInSingleDay >= 5,
      },
      {
        id: 'apprentice',
        title: 'Apprentice',
        description: 'Solve 25 algorithmic problems across any tracks.',
        icon: '🥉',
        current: Math.min(solvedCount, 25),
        target: 25,
        unlocked: solvedCount >= 25,
      },
      {
        id: 'centurion',
        title: 'Centurion',
        description: 'Cross the milestone of 100 solved DSA problems.',
        icon: '🥈',
        current: Math.min(solvedCount, 100),
        target: 100,
        unlocked: solvedCount >= 100,
      },
      {
        id: 'master',
        title: 'Master Solver',
        description: 'Solve 250 problems and conquer the core curriculum.',
        icon: '🥇',
        current: Math.min(solvedCount, 250),
        target: 250,
        unlocked: solvedCount >= 250,
      },
      {
        id: 'top10',
        title: 'Top 10 Contender',
        description: 'Climb into the Top 10 on the Pace global leaderboard.',
        icon: '👑',
        current: userRank && userRank <= 10 ? 1 : 0,
        target: 1,
        unlocked: Boolean(userRank && userRank <= 10),
      },
    ];
  }, [solvedCount, streak, maxStreak, maxInSingleDay, userRank]);

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Award size={18} color="var(--accent)" />
          <h2 className={styles.title}>Milestones &amp; Badges</h2>
        </div>
        <span className={styles.unlockedBadge}>
          {unlockedCount} of {achievements.length} Unlocked
        </span>
      </div>

      <div className={styles.grid}>
        {achievements.map((ach) => {
          const percent = Math.min(
            100,
            Math.round((ach.current / ach.target) * 100)
          );

          return (
            <div
              key={ach.id}
              className={`${styles.badgeCard} ${
                ach.unlocked
                  ? styles.badgeCardUnlocked
                  : styles.badgeCardLocked
              }`}
            >
              <div className={styles.cardTop}>
                <div
                  className={`${styles.iconWrap} ${
                    ach.unlocked ? styles.iconWrapUnlocked : ''
                  }`}
                >
                  <span>{ach.icon}</span>
                </div>
                <span
                  className={`${styles.statusPill} ${
                    ach.unlocked ? styles.statusUnlocked : styles.statusLocked
                  }`}
                >
                  {ach.unlocked ? 'Unlocked' : `${percent}%`}
                </span>
              </div>

              <h3 className={styles.badgeTitle}>{ach.title}</h3>
              <p className={styles.badgeDesc}>{ach.description}</p>

              <div className={styles.progressWrap}>
                <div className={styles.progressBarTrack}>
                  <div
                    className={`${styles.progressBarFill} ${
                      ach.unlocked ? styles.progressBarFillDone : ''
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <div className={styles.progressText}>
                  <span>Progress</span>
                  <span>
                    {ach.current} / {ach.target} {ach.unit || ''}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
