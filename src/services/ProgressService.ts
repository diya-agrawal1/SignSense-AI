import type { LetterAccuracy, LetterStats, PracticeEvent, ProgressState } from "../models/progress";

const STORAGE_KEY = "signsense.progress.v1";
const MAX_HISTORY = 30;

function emptyLetterStats(): LetterStats {
  return { attempts: 0, successes: 0, totalResponseTimeMs: 0, totalPracticeTimeMs: 0, lastPracticedAt: 0 };
}

function emptyState(): ProgressState {
  return { letters: {}, history: [], currentStreak: 0, longestStreak: 0, lastPracticeDate: null };
}

/** Local (not UTC) YYYY-MM-DD — avoids the streak flipping at the wrong hour for the user's timezone. */
function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isConsecutiveDay(previousKey: string, todayKey: string): boolean {
  const previous = new Date(previousKey + "T00:00:00");
  const today = new Date(todayKey + "T00:00:00");
  const diffDays = Math.round((today.getTime() - previous.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays === 1;
}

/**
 * ProgressService
 *
 * Stage 9: persists practice history to LocalStorage — no backend, no
 * accounts. A "round" is one pass at a target letter, from when it's
 * selected until either a held-correct sign is detected or the user moves
 * on. Callers (see useProgressTracking) are responsible for timing rounds;
 * this service just records the outcome and derives stats from history.
 */
export class ProgressService {
  static getProgress(): ProgressState {
    if (typeof localStorage === "undefined") return emptyState();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw) as Partial<ProgressState>;
      // Defensive merge in case an older/partial shape is in storage.
      return {
        letters: parsed.letters ?? {},
        history: parsed.history ?? [],
        currentStreak: parsed.currentStreak ?? 0,
        longestStreak: parsed.longestStreak ?? 0,
        lastPracticeDate: parsed.lastPracticeDate ?? null,
      };
    } catch (err) {
      console.error("[ProgressService] failed to read progress, starting fresh:", err);
      return emptyState();
    }
  }

  private static save(state: ProgressState): void {
    if (typeof localStorage === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error("[ProgressService] failed to save progress:", err);
    }
  }

  /**
   * Records one completed round for a letter.
   *
   * @param letter the target letter that was practiced
   * @param wasSuccess whether the round ended in a held-correct sign (vs. the user moving on without success)
   * @param durationMs wall-clock time spent on this round, success or not — feeds total practice time
   * @param responseTimeMs time from round start to the held-correct detection — only meaningful when wasSuccess
   */
  static recordRound(letter: string, wasSuccess: boolean, durationMs: number, responseTimeMs: number | null): void {
    const state = ProgressService.getProgress();
    const key = letter.toUpperCase();
    const now = Date.now();

    const stats = state.letters[key] ?? emptyLetterStats();
    stats.attempts += 1;
    if (wasSuccess) {
      stats.successes += 1;
      stats.totalResponseTimeMs += responseTimeMs ?? 0;
    }
    stats.totalPracticeTimeMs += Math.max(0, durationMs);
    stats.lastPracticedAt = now;
    state.letters[key] = stats;

    const event: PracticeEvent = { letter: key, wasSuccess, responseTimeMs, timestamp: now };
    state.history = [event, ...state.history].slice(0, MAX_HISTORY);

    const todayKey = toDateKey(new Date(now));
    if (state.lastPracticeDate !== todayKey) {
      if (state.lastPracticeDate && isConsecutiveDay(state.lastPracticeDate, todayKey)) {
        state.currentStreak += 1;
      } else {
        state.currentStreak = 1;
      }
      state.longestStreak = Math.max(state.longestStreak, state.currentStreak);
      state.lastPracticeDate = todayKey;
    }

    ProgressService.save(state);
  }

  /** Overall accuracy across every letter ever attempted, 0..1. Returns null if nothing's been attempted yet. */
  static getOverallAccuracy(): number | null {
    const { letters } = ProgressService.getProgress();
    let attempts = 0;
    let successes = 0;
    for (const stats of Object.values(letters)) {
      attempts += stats.attempts;
      successes += stats.successes;
    }
    return attempts === 0 ? null : successes / attempts;
  }

  static getTotalPracticeTimeMs(): number {
    const { letters } = ProgressService.getProgress();
    return Object.values(letters).reduce((sum, s) => sum + s.totalPracticeTimeMs, 0);
  }

  private static rankedAccuracy(): LetterAccuracy[] {
    const { letters } = ProgressService.getProgress();
    return Object.entries(letters)
      .filter(([, stats]) => stats.attempts > 0)
      .map(([letter, stats]) => ({ letter, attempts: stats.attempts, successRate: stats.successes / stats.attempts }));
  }

  /** Lowest success-rate letters first; ties broken toward more-attempted letters (more confident signal). */
  static getWeakLetters(limit = 5): LetterAccuracy[] {
    return ProgressService.rankedAccuracy()
      .sort((a, b) => a.successRate - b.successRate || b.attempts - a.attempts)
      .slice(0, limit);
  }

  /** Highest success-rate letters first; ties broken toward more-attempted letters. */
  static getStrongLetters(limit = 5): LetterAccuracy[] {
    return ProgressService.rankedAccuracy()
      .sort((a, b) => b.successRate - a.successRate || b.attempts - a.attempts)
      .slice(0, limit);
  }

  static getRecentHistory(limit = 10): PracticeEvent[] {
    return ProgressService.getProgress().history.slice(0, limit);
  }

  static getStreak(): { current: number; longest: number } {
    const { currentStreak, longestStreak } = ProgressService.getProgress();
    return { current: currentStreak, longest: longestStreak };
  }

  /** Wipes all locally stored progress. Exposed for the dashboard's "reset" control. */
  static reset(): void {
    ProgressService.save(emptyState());
  }
}
