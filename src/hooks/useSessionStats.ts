import { useCallback, useState } from "react";
import type { SessionStats } from "../models/sessionStats";

/** Base points awarded for each correct attempt. */
const POINTS_PER_CORRECT = 10;
/** Extra point per consecutive correct beyond the first, capped so a very long streak doesn't dwarf normal scoring. */
const MAX_STREAK_BONUS = 5;

function initialStats(): SessionStats {
  return { score: 0, streak: 0, bestStreak: 0, attempts: 0, correct: 0 };
}

interface UseSessionStatsResult extends SessionStats {
  /** Call once per resolved attempt (mirrors ProgressService.recordAttempt's timing). Updates score/streak accordingly. */
  recordResult: (isCorrect: boolean) => void;
  /** Clears score/streak back to zero — e.g. when starting a fresh practice session from Home. */
  reset: () => void;
}

/**
 * useSessionStats
 *
 * Owns the live "Score" / "Streak" readout shown in the Header while
 * practicing. Purely client-side session state - the durable record
 * (accuracy, per-letter breakdown, daily streak) stays ProgressService's
 * job; this hook only turns each attempt's correct/incorrect outcome into
 * a score and a consecutive-correct combo for immediate feedback.
 */
export function useSessionStats(): UseSessionStatsResult {
  const [stats, setStats] = useState<SessionStats>(initialStats);

  const recordResult = useCallback((isCorrect: boolean) => {
    setStats((prev) => {
      if (!isCorrect) {
        return { ...prev, attempts: prev.attempts + 1, streak: 0 };
      }

      const nextStreak = prev.streak + 1;
      const streakBonus = Math.min(nextStreak - 1, MAX_STREAK_BONUS);

      return {
        attempts: prev.attempts + 1,
        correct: prev.correct + 1,
        streak: nextStreak,
        bestStreak: Math.max(prev.bestStreak, nextStreak),
        score: prev.score + POINTS_PER_CORRECT + streakBonus,
      };
    });
  }, []);

  const reset = useCallback(() => setStats(initialStats()), []);

  return { ...stats, recordResult, reset };
}
