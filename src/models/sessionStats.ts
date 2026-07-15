/**
 * Ephemeral, in-memory session stats: score and consecutive-correct combo
 * streak for the *current* practice session only.
 *
 * Deliberately separate from ProgressState (models/progress.ts), which is
 * ProgressService's persisted, cross-session record (accuracy, per-letter
 * stats, daily practice streak). This type exists purely to drive live
 * gamification UI (Header's score/streak readout) during a session and is
 * never written to LocalStorage — resetting on refresh is intended.
 */
export interface SessionStats {
  /** Points earned so far this session. */
  score: number;
  /** Current run of consecutive correct attempts this session. Resets to 0 on a miss. */
  streak: number;
  /** Highest `streak` reached this session. */
  bestStreak: number;
  attempts: number;
  correct: number;
}
