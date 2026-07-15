import { DIFFICULTY_TIERS, TIER_ORDER } from "../../models/lessonEngine";
import type { DifficultyTier } from "../../models/lessonEngine";
import type { ProgressState } from "../../models/progress";
import { classNames } from "../../utils/classNames";
import styles from "./Sidebar.module.css";

export interface SidebarProps {
  /** The letter currently being practiced — highlighted in the list. */
  activeLetter?: string;
  /** Current progress snapshot, used to show per-letter accuracy. */
  progress?: ProgressState;
  /** The highest difficulty tier LessonEngine has unlocked so far. */
  unlockedTier?: DifficultyTier;
  /** Called when the learner clicks a letter to jump to it directly. */
  onSelectLetter?: (letter: string) => void;
}

const TIER_LABELS: Record<DifficultyTier, string> = {
  foundational: "Foundational",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function letterAccuracy(progress: ProgressState | undefined, letter: string): number | null {
  const stats = progress?.letters[letter];
  if (!stats || stats.attempts === 0) return null;
  return stats.successes / stats.attempts;
}

/**
 * Lesson navigation list, grouped by LessonEngine's difficulty tiers.
 * Shows every letter with its current mastery (as a small progress bar)
 * and which tiers are still locked — but locked letters stay clickable,
 * since the learner is always free to jump ahead manually (see TutorPage's
 * LetterPicker comment for the same design intent).
 */
export function Sidebar({ activeLetter, progress, unlockedTier = "foundational", onSelectLetter }: SidebarProps) {
  const unlockedIndex = TIER_ORDER.indexOf(unlockedTier);

  return (
    <nav className={styles.sidebar} aria-label="Lessons">
      <p className={styles.heading}>Lessons</p>

      {TIER_ORDER.map((tier, tierIndex) => {
        const isLocked = tierIndex > unlockedIndex;
        return (
          <div key={tier} className={styles.tierGroup}>
            <div className={styles.tierHeading}>
              <span>{TIER_LABELS[tier]}</span>
              {isLocked && (
                <span className={styles.lockBadge} title="Keep practicing earlier tiers to unlock this one">
                  🔒
                </span>
              )}
            </div>
            <div className={styles.letterGrid}>
              {DIFFICULTY_TIERS[tier].map((letter) => {
                const accuracy = letterAccuracy(progress, letter);
                const isActive = letter === activeLetter;
                return (
                  <button
                    key={letter}
                    type="button"
                    className={classNames(
                      styles.item,
                      isActive && styles.itemActive,
                      isLocked && styles.itemLocked
                    )}
                    onClick={() => onSelectLetter?.(letter)}
                    title={
                      isLocked
                        ? `${letter} — from a tier you haven't unlocked yet, but you can still practice it`
                        : accuracy != null
                          ? `${letter}: ${Math.round(accuracy * 100)}% accuracy`
                          : `${letter}: not practiced yet`
                    }
                  >
                    <span className={styles.itemLetter}>{letter}</span>
                    <span className={styles.itemBar}>
                      <span
                        className={styles.itemBarFill}
                        style={{ width: accuracy != null ? `${Math.round(accuracy * 100)}%` : "0%" }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
