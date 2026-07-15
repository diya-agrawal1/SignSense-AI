/**
 * Domain types for local (LocalStorage-backed) progress tracking.
 * No backend, no accounts — everything here is scoped to this browser.
 */

/** Per-letter aggregate stats. */
export interface LetterStats {
  /** How many practice rounds were started for this letter (a round starts when it becomes the target letter). */
  attempts: number;
  /** How many of those rounds ended in a held-correct sign. */
  successes: number;
  /** Sum of response times (ms) across successful rounds only — divide by successes for an average. */
  totalResponseTimeMs: number;
  /** Sum of wall-clock time (ms) spent on this letter across all rounds, successful or not. */
  totalPracticeTimeMs: number;
  /** Epoch ms of the most recent round for this letter. */
  lastPracticedAt: number;
}

/** One row in the recent-history list shown on the dashboard. */
export interface PracticeEvent {
  letter: string;
  wasSuccess: boolean;
  /** Only meaningful when wasSuccess is true. */
  responseTimeMs: number | null;
  timestamp: number;
}

/** The full shape persisted to LocalStorage. */
export interface ProgressState {
  letters: Record<string, LetterStats>;
  history: PracticeEvent[];
  currentStreak: number;
  longestStreak: number;
  /** YYYY-MM-DD of the last day any attempt was recorded — drives streak math. */
  lastPracticeDate: string | null;
}

/** Convenience shape for a letter's win rate, used when ranking weak/strong letters. */
export interface LetterAccuracy {
  letter: string;
  attempts: number;
  successRate: number; // 0..1
}
