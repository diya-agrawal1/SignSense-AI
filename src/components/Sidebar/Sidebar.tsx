import type { Difficulty } from "../../models/lessonEngine";
import type { WeakLetter } from "../../models/progress";
import styles from "./Sidebar.module.css";

export interface SidebarProps {
  /** The letter LessonEngine currently wants the learner to practice. */
  targetLetter: string;
  /** Difficulty tier of `targetLetter`. */
  difficulty: Difficulty;
  /** Overall accuracy from ProgressService, 0-100. Null before the first attempt. */
  accuracy: number | null;
  /** Current consecutive-correct combo for this session (useSessionStats). */
  sessionCombo: number;
  /** Daily practice streak from ProgressService (calendar days, not this session). */
  dailyStreak: number;
  /** Letters flagged as weak by ProgressService, worst-accuracy-first. */
  weakLetters: WeakLetter[];
  /** Highest difficulty tier currently unlocked, from LessonEngine. */
  unlockedDifficulty: Difficulty;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

/**
 * Compact progress dashboard shown alongside the camera during practice.
 * Every value comes straight from ProgressService/LessonEngine via
 * TutorPage - nothing here is mock or hardcoded, so it reads as "no
 * accuracy yet" rather than a fake lesson list when there's no history.
 */
export function Sidebar({
  targetLetter,
  difficulty,
  accuracy,
  sessionCombo,
  dailyStreak,
  weakLetters,
  unlockedDifficulty,
}: SidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Practice progress">
      <p className={styles.heading}>Now practicing</p>
      <div className={styles.rows}>
        <StatRow label="Target letter" value={targetLetter} />
        <StatRow label="Difficulty" value={difficulty} />
      </div>

      <p className={styles.heading}>Progress</p>
      <div className={styles.rows}>
        <StatRow label="Accuracy" value={accuracy != null ? `${accuracy}%` : "—"} />
        <StatRow label="Session combo" value={String(sessionCombo)} />
        <StatRow label="Daily streak" value={String(dailyStreak)} />
        <StatRow label="Unlocked tier" value={unlockedDifficulty} />
      </div>

      <p className={styles.heading}>Weak letters</p>
      {weakLetters.length === 0 ? (
        <p className={styles.emptyState}>No weak letters yet.</p>
      ) : (
        <div className={styles.weakList}>
          {weakLetters.map((w) => (
            <span key={w.letter} className={styles.weakChip}>
              {w.letter} · {w.accuracy}%
            </span>
          ))}
        </div>
      )}
    </nav>
  );
}
