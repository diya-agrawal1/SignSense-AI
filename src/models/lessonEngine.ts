/**
 * Domain types for LessonEngine (Stage 10): turns locally-stored practice
 * statistics (ProgressState, from models/progress.ts) into a decision
 * about what to practice next. Pure data in, pure data out — no
 * MediaPipe/TF.js/DOM dependencies, so it's trivially unit-testable and
 * has no runtime cost beyond simple arithmetic over already-in-memory
 * stats.
 */

/**
 * Curriculum tiers, unlocked in order as the learner demonstrates
 * competence in the previous tier (see LessonEngine.getUnlockedTier).
 *
 * Grouping rationale (a reasonable default, not an objective ranking —
 * tune freely):
 *  - foundational: visually distinct, low mutual-confusion handshapes,
 *    good first letters for building basic hand-tracking confidence.
 *  - intermediate: the bulk of the alphabet — moderate shape complexity.
 *  - advanced: letters with real, documented confusion risk. M and N in
 *    particular were the softest-scoring classes (~0.94 precision/recall
 *    vs 0.97+ elsewhere) in this project's own classifier training
 *    report; S is a closed-fist shape commonly confused with A/E/M/N/T
 *    in ASL instruction generally; J and Z are motion signs that
 *    PoseAnalysisService can only approximate as a static frame (see
 *    aslAlphabetReference.ts) and are intentionally practiced last.
 */
export type DifficultyTier = "foundational" | "intermediate" | "advanced";

export const DIFFICULTY_TIERS: Record<DifficultyTier, readonly string[]> = {
  foundational: ["A", "B", "C", "L", "O", "Y"],
  intermediate: ["D", "E", "F", "G", "H", "I", "K", "P", "Q", "R", "U", "V", "W", "X"],
  advanced: ["J", "M", "N", "S", "T", "Z"],
};

export const TIER_ORDER: readonly DifficultyTier[] = ["foundational", "intermediate", "advanced"];

/** A single letter's computed priority for "what to practice next". Higher score = more in need of practice. */
export interface LetterPriority {
  letter: string;
  score: number;
  /** True if this letter has never been attempted (progress.letters has no entry for it). */
  isUnseen: boolean;
}

export type PracticePromptType = "letter" | "word";

export interface PracticePrompt {
  type: PracticePromptType;
  /** The single letter to practice. Always set for type "letter"; also set for type "word" as the word's first letter, so callers that only care about a single target (e.g. PoseAnalysisService) still have something to compare against. */
  letter: string;
  /** Only set when type is "word" — a short word built entirely from letters the learner currently has reasonable mastery over. */
  word?: string;
  /** The unlocked difficulty tier this prompt was drawn from. */
  tier: DifficultyTier;
  /** Short human-readable justification, useful for UI copy and debugging ("why did it pick this?"). */
  reason: string;
}

export interface LessonEngineOptions {
  /** Average success rate (0..1) within a tier required to unlock the next one. Default 0.75. */
  tierUnlockAccuracy?: number;
  /** Minimum attempts across a tier's attempted letters before it's eligible to unlock the next tier — prevents one lucky early attempt from unlocking too fast. Default 8. */
  tierUnlockMinAttempts?: number;
  /** Minimum per-letter success rate to count that letter as "ready" for use in a spelling exercise. Default 0.7. */
  wordReadyAccuracy?: number;
  /** Minimum attempts on a letter before it counts as "ready" for spelling exercises. Default 3. */
  wordReadyMinAttempts?: number;
  /** Roughly 1-in-N practice prompts should be a spelling exercise (when enough letters are word-ready). Default 4. */
  wordFrequency?: number;
}
