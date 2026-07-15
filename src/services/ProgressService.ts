import type { LetterStats, ProgressState, ProgressSummary, WeakLetter } from "../models/progress";

/** LocalStorage key. Versioned suffix so a future shape change can migrate/reset cleanly instead of crashing on old data. */
const STORAGE_KEY = "signsense.progress.v1";

/** A letter needs at least this many attempts before its accuracy is trustworthy enough to call it "weak". */
const MIN_ATTEMPTS_FOR_WEAK_LETTER = 3;

/** How many weak letters to surface at once. */
const DEFAULT_WEAK_LETTER_LIMIT = 5;

function emptyState(): ProgressState {
  return {
    totalAttempts: 0,
    correctAttempts: 0,
    totalResponseTimeMs: 0,
    timedAttempts: 0,
    letters: {},
    lastPracticeDate: null,
    currentStreak: 0,
    longestStreak: 0,
  };
}

/** Local YYYY-MM-DD (not UTC) so a streak doesn't break just because the user practiced late at night in their own timezone. */
function todayKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = new Date(`${fromKey}T00:00:00`);
  const to = new Date(`${toKey}T00:00:00`);
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

/**
 * ProgressService
 *
 * Stage 9: local, account-free practice tracking. Persists accuracy,
 * attempt counts, average response time, per-letter weak spots, and a
 * daily practice streak to LocalStorage.
 *
 * Static + stateless by design (mirrors PoseAnalysisService): every method
 * reads the latest state from LocalStorage and, for writes, persists the
 * updated state back immediately. No in-memory cache, so multiple tabs
 * stay consistent and there's nothing to keep in sync with React state.
 */
export class ProgressService {
  /** Reads the current progress state, or a fresh empty one if nothing has been saved yet (or storage is unavailable/corrupt). */
  static getProgress(): ProgressState {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<ProgressState>;
      // Merge over a fresh default so a future field addition doesn't leave older saved data with `undefined`s.
      return { ...emptyState(), ...parsed };
    } catch (err) {
      console.error("[ProgressService] failed to read progress, starting fresh:", err);
      return emptyState();
    }
  }

  private static save(state: ProgressState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("[ProgressService] failed to persist progress:", err);
    }
  }

  /**
   * Records one practice attempt at a target letter and persists the
   * result. Updates overall + per-letter accuracy, the running response
   * time average, and the daily streak (advances at most once per
   * calendar day, regardless of how many attempts happen that day).
   *
   * @param letter the target letter being practiced (case-insensitive)
   * @param isCorrect whether this attempt matched the expected pose
   * @param responseTimeMs optional time taken to reach this attempt, in ms; omit if not measured
   */
  static recordAttempt(letter: string, isCorrect: boolean, responseTimeMs?: number): ProgressState {
    const state = ProgressService.getProgress();
    const key = letter.toUpperCase();

    const existing: LetterStats = state.letters[key] ?? {
      attempts: 0,
      correct: 0,
      totalResponseTimeMs: 0,
      timedAttempts: 0,
    };

    const updatedLetterStats: LetterStats = {
      attempts: existing.attempts + 1,
      correct: existing.correct + (isCorrect ? 1 : 0),
      totalResponseTimeMs: existing.totalResponseTimeMs + (responseTimeMs ?? 0),
      timedAttempts: existing.timedAttempts + (responseTimeMs != null ? 1 : 0),
    };

    const next: ProgressState = {
      ...state,
      totalAttempts: state.totalAttempts + 1,
      correctAttempts: state.correctAttempts + (isCorrect ? 1 : 0),
      totalResponseTimeMs: state.totalResponseTimeMs + (responseTimeMs ?? 0),
      timedAttempts: state.timedAttempts + (responseTimeMs != null ? 1 : 0),
      letters: { ...state.letters, [key]: updatedLetterStats },
      ...ProgressService.advanceStreak(state),
    };

    ProgressService.save(next);
    return next;
  }

  /** Computes the streak fields for "practicing right now", without touching anything else. Pure so recordAttempt can spread the result in. */
  private static advanceStreak(state: ProgressState): Pick<ProgressState, "lastPracticeDate" | "currentStreak" | "longestStreak"> {
    const today = todayKey();

    if (state.lastPracticeDate === today) {
      // Already practiced today — streak doesn't change, just re-confirm today's date.
      return { lastPracticeDate: today, currentStreak: state.currentStreak, longestStreak: state.longestStreak };
    }

    const gap = state.lastPracticeDate ? daysBetween(state.lastPracticeDate, today) : null;
    const currentStreak = gap === 1 ? state.currentStreak + 1 : 1; // consecutive day continues the streak, any other gap restarts it

    return {
      lastPracticeDate: today,
      currentStreak,
      longestStreak: Math.max(state.longestStreak, currentStreak),
    };
  }

  /** 0-100 overall accuracy, rounded. Null when there have been no attempts yet. */
  static getAccuracy(state: ProgressState = ProgressService.getProgress()): number | null {
    if (state.totalAttempts === 0) return null;
    return Math.round((state.correctAttempts / state.totalAttempts) * 100);
  }

  /** Average response time in ms across attempts that reported one. Null when none have. */
  static getAverageResponseTimeMs(state: ProgressState = ProgressService.getProgress()): number | null {
    if (state.timedAttempts === 0) return null;
    return Math.round(state.totalResponseTimeMs / state.timedAttempts);
  }

  /** Current + longest daily practice streak. */
  static getStreak(state: ProgressState = ProgressService.getProgress()): { current: number; longest: number } {
    return { current: state.currentStreak, longest: state.longestStreak };
  }

  /**
   * Letters ranked worst-accuracy-first (ties broken by more attempts
   * first, since that's a more reliable signal), limited to letters with
   * at least MIN_ATTEMPTS_FOR_WEAK_LETTER attempts so a single unlucky
   * miss doesn't brand a barely-tried letter as "weak".
   */
  static getWeakLetters(
    state: ProgressState = ProgressService.getProgress(),
    limit: number = DEFAULT_WEAK_LETTER_LIMIT
  ): WeakLetter[] {
    return Object.entries(state.letters)
      .map(([letter, stats]) => ({
        letter,
        attempts: stats.attempts,
        correct: stats.correct,
        accuracy: Math.round((stats.correct / stats.attempts) * 100),
      }))
      .filter((entry) => entry.attempts >= MIN_ATTEMPTS_FOR_WEAK_LETTER)
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
      .slice(0, limit);
  }

  /** Convenience bundle of everything a progress UI would want to render, in one call. */
  static getSummary(state: ProgressState = ProgressService.getProgress()): ProgressSummary {
    return {
      totalAttempts: state.totalAttempts,
      accuracy: ProgressService.getAccuracy(state),
      averageResponseTimeMs: ProgressService.getAverageResponseTimeMs(state),
      currentStreak: state.currentStreak,
      longestStreak: state.longestStreak,
      weakLetters: ProgressService.getWeakLetters(state),
    };
  }

  /** Clears all saved progress. Mainly for a "reset" control and tests. */
  static reset(): void {
    ProgressService.save(emptyState());
  }
}
