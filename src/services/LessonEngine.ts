import { ASL_ALPHABET_REFERENCE } from "../models/aslAlphabetReference";
import { DIFFICULTY_TIERS, TIER_ORDER } from "../models/lessonEngine";
import type { DifficultyTier, LessonEngineOptions, LetterPriority, PracticePrompt } from "../models/lessonEngine";
import { SPELLING_WORD_LIST } from "../models/spellingWordList";
import type { LetterStats, ProgressState } from "../models/progress";

const DEFAULT_OPTIONS: Required<LessonEngineOptions> = {
  tierUnlockAccuracy: 0.75,
  tierUnlockMinAttempts: 8,
  wordReadyAccuracy: 0.7,
  wordReadyMinAttempts: 3,
  wordFrequency: 4,
};

/**
 * Bayesian-ish smoothing so a single early success/failure doesn't swing
 * a letter's priority wildly. Equivalent to starting every letter with
 * 3 "phantom" attempts at a 50% success rate, which fades out as real
 * attempts accumulate.
 */
const PRIOR_ATTEMPTS = 3;
const PRIOR_SUCCESS_RATE = 0.5;

/**
 * LessonEngine
 *
 * Input: ProgressState (local practice statistics — see models/progress.ts
 * and ProgressService, which already persists it to LocalStorage).
 * Output: a PracticePrompt — the next single letter, or an occasional
 * short spelling exercise once enough letters are reasonably solid.
 *
 * Entirely a pure, offline, dependency-free module: no network calls, no
 * DOM access, no backend. Every decision is a function of the stats
 * already sitting in ProgressState.
 */
export class LessonEngine {
  /**
   * Decides which difficulty tier is currently unlocked, based on
   * average accuracy within each tier in order. A tier only unlocks once
   * the previous one has both enough attempts and a high enough average
   * success rate — this is what makes difficulty increase gradually
   * rather than jumping straight to the hardest letters.
   */
  static getUnlockedTier(progress: ProgressState, options: LessonEngineOptions = {}): DifficultyTier {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    for (let i = 0; i < TIER_ORDER.length - 1; i++) {
      const tier = TIER_ORDER[i];
      const tierLetters = DIFFICULTY_TIERS[tier];

      const attempted = tierLetters
        .map((letter) => progress.letters[letter])
        .filter((stats): stats is LetterStats => stats != null && stats.attempts > 0);

      const totalAttempts = attempted.reduce((sum, s) => sum + s.attempts, 0);
      const totalSuccesses = attempted.reduce((sum, s) => sum + s.successes, 0);
      const accuracy = totalAttempts === 0 ? 0 : totalSuccesses / totalAttempts;

      const tierMastered = totalAttempts >= opts.tierUnlockMinAttempts && accuracy >= opts.tierUnlockAccuracy;
      if (!tierMastered) return tier;
    }

    return TIER_ORDER[TIER_ORDER.length - 1];
  }

  /**
   * All letters practice-eligible right now: every tier up to and
   * including the currently-unlocked one, flattened. Cumulative on
   * purpose — a tier unlocking doesn't mean earlier tiers are "done
   * forever", just that they've been solid *on average*. Individual weak
   * letters from an earlier tier (e.g. one letter dragged down by early
   * bad luck) still need to keep resurfacing via scoreLetter, not get
   * orphaned the moment a harder tier opens up.
   */
  static getUnlockedPool(progress: ProgressState, options: LessonEngineOptions = {}): string[] {
    const unlockedTier = LessonEngine.getUnlockedTier(progress, options);
    const unlockedIndex = TIER_ORDER.indexOf(unlockedTier);
    return TIER_ORDER.slice(0, unlockedIndex + 1).flatMap((tier) => DIFFICULTY_TIERS[tier]);
  }

  /**
   * Smoothed weakness score for one letter: higher = more in need of
   * practice. Unseen letters always sort first (real exposure beats a
   * guess about difficulty), everything else is ranked by smoothed miss
   * rate.
   */
  private static scoreLetter(letter: string, stats: LetterStats | undefined): LetterPriority {
    if (!stats || stats.attempts === 0) {
      return { letter, score: Number.POSITIVE_INFINITY, isUnseen: true };
    }

    const smoothedSuccessRate =
      (stats.successes + PRIOR_ATTEMPTS * PRIOR_SUCCESS_RATE) / (stats.attempts + PRIOR_ATTEMPTS);

    return { letter, score: 1 - smoothedSuccessRate, isUnseen: false };
  }

  /** Priority-ranked letters across a pool, weakest/least-practiced first. */
  static rankLetters(letters: readonly string[], progress: ProgressState): LetterPriority[] {
    return letters
      .map((letter) => LessonEngine.scoreLetter(letter, progress.letters[letter]))
      .sort((a, b) => b.score - a.score);
  }

  /** The single next letter to practice: highest-priority letter across every currently-unlocked tier. */
  static getNextLetter(progress: ProgressState, options: LessonEngineOptions = {}): { letter: string; tier: DifficultyTier; reason: string } {
    const tier = LessonEngine.getUnlockedTier(progress, options);
    const pool = LessonEngine.getUnlockedPool(progress, options);
    const ranked = LessonEngine.rankLetters(pool, progress);
    const top = ranked[0];
    const topTier = TIER_ORDER.find((t) => DIFFICULTY_TIERS[t].includes(top.letter)) ?? tier;

    const reason = top.isUnseen
      ? `New letter in the ${topTier} set.`
      : `Weakest letter practiced so far (${Math.round((1 - top.score) * 100)}% smoothed accuracy).`;

    return { letter: top.letter, tier: topTier, reason };
  }

  /**
   * Which letters currently have "enough mastery" to be used inside a
   * spelling exercise — deliberately a bit stricter than just "not the
   * single weakest letter", so exercises reinforce genuine strengths
   * rather than letters the learner is still actively struggling with.
   */
  static getWordReadyLetters(progress: ProgressState, options: LessonEngineOptions = {}): Set<string> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const ready = new Set<string>();

    for (const [letter, stats] of Object.entries(progress.letters)) {
      if (stats.attempts < opts.wordReadyMinAttempts) continue;
      if (stats.successes / stats.attempts >= opts.wordReadyAccuracy) ready.add(letter);
    }

    return ready;
  }

  /**
   * Picks a word from SPELLING_WORD_LIST that's fully spellable using
   * only `readyLetters`. Prefers longer words (more reinforcement per
   * exercise) among the spellable set. Returns null if nothing qualifies
   * yet (e.g. fewer than ~2 letters are word-ready) — callers should
   * fall back to a single-letter prompt in that case.
   */
  static pickSpellingWord(readyLetters: Set<string>): string | null {
    if (readyLetters.size < 2) return null;

    const spellable = SPELLING_WORD_LIST.filter((word) =>
      [...word].every((char) => readyLetters.has(char))
    );
    if (spellable.length === 0) return null;

    const longest = spellable.reduce((best, w) => (w.length > best.length ? w : best), spellable[0]);
    return longest;
  }

  /**
   * Full decision: the next practice prompt, occasionally a spelling
   * exercise instead of a single letter once enough letters are
   * word-ready. `promptCount` is a simple external counter (e.g. how many
   * prompts have been served this session) driving the roughly-1-in-N
   * cadence — pass whatever monotonically increasing counter is
   * convenient for the caller (session round count works well).
   */
  static getNextPrompt(progress: ProgressState, promptCount: number, options: LessonEngineOptions = {}): PracticePrompt {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const { letter, tier, reason } = LessonEngine.getNextLetter(progress, options);

    const isWordTurn = opts.wordFrequency > 0 && promptCount > 0 && promptCount % opts.wordFrequency === 0;
    if (isWordTurn) {
      const readyLetters = LessonEngine.getWordReadyLetters(progress, options);
      const word = LessonEngine.pickSpellingWord(readyLetters);
      if (word) {
        return {
          type: "word",
          letter: word[0],
          word,
          tier,
          reason: `Spelling practice using letters you've got solid: ${[...new Set(word.split(""))].join(", ")}.`,
        };
      }
      // Not enough word-ready letters yet — fall through to a normal single-letter prompt.
    }

    return { type: "letter", letter, tier, reason };
  }
}

/** Every letter this engine can ever suggest — matches the ASL reference table 1:1, kept here so callers don't need their own copy. */
export const ALL_LESSON_ENGINE_LETTERS: readonly string[] = Object.keys(ASL_ALPHABET_REFERENCE);
