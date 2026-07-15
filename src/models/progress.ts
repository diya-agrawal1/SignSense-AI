/**
 * Domain types for local practice-progress tracking (Stage 9).
 * Plain, serializable data — safe to persist to LocalStorage as-is.
 */

/** Running stats for a single ASL letter, accumulated across attempts. */
export interface LetterStats {
  attempts: number;
  correct: number;
  /** Sum of response times (ms) for attempts that reported one — used with `timedAttempts` to average. */
  totalResponseTimeMs: number;
  /** How many attempts for this letter reported a response time (not every caller supplies one). */
  timedAttempts: number;
}

/**
 * Full persisted progress state. One record per browser/device — there's
 * no account system yet, so this is intentionally global rather than
 * per-user.
 */
export interface ProgressState {
  totalAttempts: number;
  correctAttempts: number;
  totalResponseTimeMs: number;
  timedAttempts: number;
  /** Per-letter breakdown, keyed by uppercase letter (e.g. "A"). */
  letters: Record<string, LetterStats>;
  /** ISO date (YYYY-MM-DD, local time) of the most recent practice day. Null until the first attempt. */
  lastPracticeDate: string | null;
  currentStreak: number;
  longestStreak: number;
}

/** Read-only summary derived from a ProgressState — what the UI actually renders. */
export interface ProgressSummary {
  totalAttempts: number;
  /** 0-100, rounded. Null when there have been no attempts yet. */
  accuracy: number | null;
  /** Milliseconds, rounded. Null when no attempt has reported a response time. */
  averageResponseTimeMs: number | null;
  currentStreak: number;
  longestStreak: number;
  /** Letters ranked worst-accuracy-first, each requiring at least `MIN_ATTEMPTS_FOR_WEAK_LETTER` attempts to qualify. */
  weakLetters: WeakLetter[];
}

export interface WeakLetter {
  letter: string;
  attempts: number;
  correct: number;
  /** 0-100, rounded. */
  accuracy: number;
}
