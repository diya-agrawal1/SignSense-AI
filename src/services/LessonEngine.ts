import type { ProgressState } from "../models/progress";
import type { Difficulty, NextLetterResult, SpellingExercise, TierProgress } from "../models/lessonEngine";
import { ProgressService } from "./ProgressService";

/** Tiers are checked in this order — index also doubles as "how advanced". */
const DIFFICULTY_ORDER: readonly Difficulty[] = ["beginner", "intermediate", "advanced"];

/**
 * Static per-letter difficulty. Mirrors the simplifications already
 * documented on LetterReference (models/poseAnalysis.ts): the M/N/S/T
 * cluster is hard to disambiguate by extension state alone, and J/Z are
 * motion letters approximated by a static frame — both bumped to
 * "advanced" rather than pretending they're as learnable as, say, B or L.
 */
const LETTER_DIFFICULTY: Record<string, Difficulty> = {
  A: "beginner", B: "beginner", C: "beginner", D: "beginner", E: "beginner",
  F: "beginner", I: "beginner", L: "beginner", O: "beginner", U: "beginner",
  V: "beginner", W: "beginner", Y: "beginner",
  G: "intermediate", H: "intermediate", K: "intermediate", P: "intermediate",
  Q: "intermediate", R: "intermediate", X: "intermediate",
  J: "advanced", M: "advanced", N: "advanced", S: "advanced", T: "advanced", Z: "advanced",
};

/** A tier is "mastered" (and the next one unlocked) once its letters have been attempted this many times in total... */
const REQUIRED_ATTEMPTS_PER_TIER = 15;
/** ...and are being gotten right at least this often. Both gates exist so a lucky streak on 2 attempts can't skip a tier. */
const REQUIRED_ACCURACY_TO_ADVANCE = 75;

/** A letter needs at least this accuracy to be treated as "known" for the purpose of building spelling words out of it. */
const KNOWN_LETTER_ACCURACY = 60;

/**
 * Small built-in word list for spelling exercises — everything the engine
 * needs ships in the bundle, so lesson generation works fully offline with
 * no backend. Grouped loosely by length as a simple difficulty proxy
 * (short words first); each entry is a candidate, not a fixed curriculum —
 * generateSpellingExercise() filters this down to what the learner can
 * actually spell right now.
 */
const WORD_BANK: readonly string[] = [
  // beginner (3 letters)
  "CAT", "DOG", "SUN", "HAT", "CUP", "BED", "BOX", "RUN", "PEN", "BAG", "OWL", "BUS",
  // intermediate (4-5 letters)
  "BIRD", "FISH", "BOOK", "LAMP", "STAR", "MILK", "DESK", "GATE", "SHOE", "FROG", "TABLE", "HOUSE",
  // advanced (5-6 letters)
  "PLANT", "SMILE", "GRAPE", "CHAIR", "STONE", "BRUSH", "CLOUD", "GARDEN",
];

function wordDifficulty(word: string): Difficulty {
  if (word.length <= 3) return "beginner";
  if (word.length <= 5) return "intermediate";
  return "advanced";
}

function lettersUpTo(maxDifficulty: Difficulty): string[] {
  const maxIndex = DIFFICULTY_ORDER.indexOf(maxDifficulty);
  return Object.keys(LETTER_DIFFICULTY).filter(
    (letter) => DIFFICULTY_ORDER.indexOf(LETTER_DIFFICULTY[letter]) <= maxIndex
  );
}

function accuracyFor(state: ProgressState, letter: string): number | null {
  const stats = state.letters[letter];
  if (!stats || stats.attempts === 0) return null;
  return Math.round((stats.correct / stats.attempts) * 100);
}

function attemptsFor(state: ProgressState, letter: string): number {
  return state.letters[letter]?.attempts ?? 0;
}

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * LessonEngine
 *
 * Stage 10: turns raw practice statistics (from ProgressService) into a
 * concrete "what should the learner practice next" decision — a single
 * target letter, or a short spelling word. Entirely offline: no network
 * calls, no backend, just the static tables above plus whatever's already
 * in LocalStorage via ProgressService.
 *
 * Static + stateless like ProgressService/PoseAnalysisService: every
 * method takes the stats it needs as a plain ProgressState (defaulting to
 * ProgressService.getProgress()), so it's trivial to test with a
 * hand-built state and never gets out of sync with what's persisted.
 */
export class LessonEngine {
  /** Difficulty tier a given letter belongs to. Falls back to "beginner" for any letter not in the table (shouldn't happen for A-Z). */
  static getDifficultyForLetter(letter: string): Difficulty {
    return LETTER_DIFFICULTY[letter.toUpperCase()] ?? "beginner";
  }

  /** Aggregate attempts/accuracy across every letter in a difficulty tier, used to decide whether it's mastered. */
  private static tierStats(state: ProgressState, difficulty: Difficulty): { attempts: number; correct: number } {
    return Object.entries(state.letters)
      .filter(([letter]) => LETTER_DIFFICULTY[letter] === difficulty)
      .reduce(
        (totals, [, stats]) => ({ attempts: totals.attempts + stats.attempts, correct: totals.correct + stats.correct }),
        { attempts: 0, correct: 0 }
      );
  }

  private static isTierMastered(state: ProgressState, difficulty: Difficulty): boolean {
    const { attempts, correct } = LessonEngine.tierStats(state, difficulty);
    if (attempts < REQUIRED_ATTEMPTS_PER_TIER) return false;
    return (correct / attempts) * 100 >= REQUIRED_ACCURACY_TO_ADVANCE;
  }

  /** The highest difficulty tier currently unlocked. Always at least "beginner". Advances one tier at a time — never skips intermediate even if someone is somehow crushing it. */
  static getUnlockedDifficulty(state: ProgressState = ProgressService.getProgress()): Difficulty {
    let unlocked: Difficulty = "beginner";
    for (const tier of DIFFICULTY_ORDER) {
      if (tier === "beginner") continue;
      const previousTier = DIFFICULTY_ORDER[DIFFICULTY_ORDER.indexOf(tier) - 1];
      if (LessonEngine.isTierMastered(state, previousTier)) {
        unlocked = tier;
      } else {
        break;
      }
    }
    return unlocked;
  }

  /** Progress toward unlocking each tier — handy for a "3/15 attempts, 60% accuracy (need 75%)" style progress UI. */
  static getTierProgress(state: ProgressState = ProgressService.getProgress()): TierProgress[] {
    const unlocked = LessonEngine.getUnlockedDifficulty(state);
    const unlockedIndex = DIFFICULTY_ORDER.indexOf(unlocked);
    return DIFFICULTY_ORDER.map((difficulty, index) => {
      const { attempts, correct } = LessonEngine.tierStats(state, difficulty);
      return {
        difficulty,
        unlocked: index <= unlockedIndex,
        attempts,
        requiredAttempts: REQUIRED_ATTEMPTS_PER_TIER,
        accuracy: attempts === 0 ? null : Math.round((correct / attempts) * 100),
        requiredAccuracy: REQUIRED_ACCURACY_TO_ADVANCE,
      };
    });
  }

  /**
   * Picks the next letter to practice.
   *
   * Rules, in priority order:
   *  1. Weak letters first (per ProgressService's weak-letter threshold),
   *     restricted to what's currently unlocked.
   *  2. Otherwise, a fresh letter within the unlocked range that hasn't
   *     been attempted yet — this is what makes difficulty ramp up
   *     gradually instead of jumping straight to hard letters.
   *  3. Otherwise (everything unlocked has been tried, nothing is
   *     currently "weak"), reinforce the lowest-accuracy unlocked letter
   *     so practice keeps circulating instead of stalling.
   *
   * @param excludeLetter avoid immediately repeating this letter when a reasonable alternative exists (e.g. the letter just practiced)
   */
  static getNextLetter(
    state: ProgressState = ProgressService.getProgress(),
    excludeLetter?: string
  ): NextLetterResult {
    const unlocked = LessonEngine.getUnlockedDifficulty(state);
    const pool = new Set(lettersUpTo(unlocked));
    const exclude = excludeLetter?.toUpperCase();

    const weakInPool = ProgressService.getWeakLetters(state, pool.size).filter((w) => pool.has(w.letter));
    const weakChoice = weakInPool.find((w) => w.letter !== exclude) ?? weakInPool[0];
    if (weakChoice) {
      return { letter: weakChoice.letter, difficulty: LETTER_DIFFICULTY[weakChoice.letter], reason: "weak_letter" };
    }

    const untried = [...pool].filter((letter) => attemptsFor(state, letter) === 0 && letter !== exclude);
    if (untried.length > 0) {
      const letter = pickRandom(untried);
      return { letter, difficulty: LETTER_DIFFICULTY[letter], reason: "new_letter" };
    }

    // Nothing weak, nothing new — reinforce whatever's currently the softest spot in the unlocked pool.
    const ranked = [...pool]
      .filter((letter) => letter !== exclude)
      .map((letter) => ({ letter, accuracy: accuracyFor(state, letter) ?? 100, attempts: attemptsFor(state, letter) }))
      .sort((a, b) => a.accuracy - b.accuracy || a.attempts - b.attempts);

    const fallbackLetter = ranked[0]?.letter ?? exclude ?? [...pool][0];
    return { letter: fallbackLetter, difficulty: LETTER_DIFFICULTY[fallbackLetter], reason: "reinforce" };
  }

  /**
   * Builds a short spelling exercise out of WORD_BANK, preferring words
   * whose letters the learner already knows reasonably well (>=
   * KNOWN_LETTER_ACCURACY) so spelling practice combines skills instead of
   * introducing brand-new letters mid-word. Falls back progressively (any
   * unlocked letter, then any word at all) so it never returns nothing.
   */
  static generateSpellingExercise(state: ProgressState = ProgressService.getProgress()): SpellingExercise {
    const unlocked = LessonEngine.getUnlockedDifficulty(state);
    const unlockedPool = new Set(lettersUpTo(unlocked));
    const knownPool = new Set([...unlockedPool].filter((letter) => (accuracyFor(state, letter) ?? 0) >= KNOWN_LETTER_ACCURACY));

    const usesOnly = (word: string, pool: Set<string>) => [...word].every((letter) => pool.has(letter));

    const knownMatches = WORD_BANK.filter((word) => usesOnly(word, knownPool));
    const unlockedMatches = WORD_BANK.filter((word) => usesOnly(word, unlockedPool));

    const word = knownMatches.length > 0
      ? pickRandom(knownMatches)
      : unlockedMatches.length > 0
        ? pickRandom(unlockedMatches)
        : pickRandom(WORD_BANK); // cold start / edge case: nothing matches yet, just offer something

    return { word, letters: [...word], difficulty: wordDifficulty(word) };
  }
}
