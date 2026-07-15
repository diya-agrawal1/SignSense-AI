import { useEffect, useRef } from "react";
import { ProgressService } from "../services/ProgressService";
import type { PoseAnalysisResult } from "../models/poseAnalysis";

/** How long isCorrect must stay true before a round counts as a success — same window usePoseFeedback uses to decide the live hand shape has "settled", so a success and an LLM phrasing update land around the same moment. */
const HOLD_MS = 600;

/**
 * useProgressTracking
 *
 * Stage 9: turns live pose analysis into persisted practice history.
 *
 * A "round" starts the moment `targetLetter` is set/changes, and ends one
 * of two ways:
 *   - success: `analysis.isCorrect` flips to true and holds for HOLD_MS
 *     ("flips to true for a beat", not a single lucky frame)
 *   - abandoned: the user switches to a different letter (or unmounts)
 *     before ever holding a correct sign — recorded as an unsuccessful
 *     attempt so accuracy reflects real practice, not just wins
 *
 * Purely a side-effecting hook — nothing rendered, nothing returned (aside
 * from firing `onRoundComplete`, if provided, exactly once per round close —
 * Stage 10's LessonEngine uses this to advance to its next suggested
 * prompt right when a round actually finishes, rather than guessing).
 * Mount it once per active practice session (TutorPage).
 *
 * Note: React StrictMode's dev-only mount→cleanup→mount cycle will record
 * one extra spurious "abandoned" round per letter change in development.
 * Harmless (progress data is approximate by nature) and doesn't happen in
 * production builds, but worth knowing if dev-mode numbers look slightly
 * inflated.
 */
export function useProgressTracking(
  targetLetter: string | null,
  analysis: PoseAnalysisResult | null,
  onRoundComplete?: (letter: string, wasSuccess: boolean) => void
): void {
  const currentLetterRef = useRef<string | null>(null);
  const roundStartRef = useRef<number>(0);
  const successLoggedRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onRoundCompleteRef = useRef(onRoundComplete);
  onRoundCompleteRef.current = onRoundComplete;

  // Start a new round whenever the target letter changes. The round is
  // closed out in this same effect's cleanup — which React runs exactly
  // once per transition (right before the next run, or on unmount) — so
  // "record the previous round" lives in exactly one place, not two.
  useEffect(() => {
    currentLetterRef.current = targetLetter;
    roundStartRef.current = Date.now();
    successLoggedRef.current = false;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    return () => {
      if (currentLetterRef.current && !successLoggedRef.current) {
        const durationMs = Date.now() - roundStartRef.current;
        ProgressService.recordRound(currentLetterRef.current, false, durationMs, null);
        onRoundCompleteRef.current?.(currentLetterRef.current, false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLetter]);

  // Watch for a held-correct sign within the current round.
  //
  // Deliberately depends on `analysis?.isCorrect` (a primitive boolean),
  // NOT `analysis` itself — usePoseFeedback recomputes a brand new
  // `analysis` object on every tracked frame (many times a second) even
  // when isCorrect's value hasn't changed, since it's a useMemo keyed on
  // `landmarks`. Depending on the object was the original bug here: this
  // effect's cleanup cleared the hold timer on every re-run, and frames
  // arrive far more often than HOLD_MS, so the timer was reset before it
  // ever got a chance to fire — a 100%-correct hold was never recorded.
  // Depending on the boolean means this effect only re-runs when
  // correctness actually flips, which is the only time the timer should
  // restart.
  const isCorrect = analysis?.isCorrect ?? false;
  useEffect(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (!isCorrect || successLoggedRef.current || !currentLetterRef.current) return;

    const letter = currentLetterRef.current;
    const startedAt = roundStartRef.current;

    holdTimerRef.current = setTimeout(() => {
      if (successLoggedRef.current) return; // already closed out (e.g. letter changed right at the boundary)
      const now = Date.now();
      const responseTimeMs = now - startedAt;
      ProgressService.recordRound(letter, true, responseTimeMs, responseTimeMs);
      successLoggedRef.current = true;
      onRoundCompleteRef.current?.(letter, true);
    }, HOLD_MS);

    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, [isCorrect]);
}
