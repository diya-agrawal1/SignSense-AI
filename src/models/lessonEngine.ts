/** Difficulty tier for a letter or word — the adaptive engine's own vocabulary, no longer borrowed from the old placeholder Lesson type. */
export type Difficulty = "beginner" | "intermediate" | "advanced";

/** Why the engine picked the letter it did — useful for UI copy ("Let's revisit...", "New letter!", or a learner's own manual pick). */
export type NextLetterReason =
  | "weak_letter" // resurfacing a letter the learner has struggled with
  | "new_letter" // introducing a letter not attempted yet within the unlocked difficulty range
  | "reinforce" // everything unlocked has been tried and nothing counts as "weak" yet; keep circulating
  | "manual"; // learner picked this letter directly, overriding the engine's pick

export interface NextLetterResult {
  letter: string;
  difficulty: Difficulty;
  reason: NextLetterReason;
}

/** A short offline word chosen so its letters fall within what the learner has unlocked/practiced. */
export interface SpellingExercise {
  word: string;
  letters: string[];
  difficulty: Difficulty;
}

/** How close the learner is to unlocking the next difficulty tier — for progress UI. */
export interface TierProgress {
  difficulty: Difficulty;
  unlocked: boolean;
  attempts: number;
  requiredAttempts: number;
  accuracy: number | null;
  requiredAccuracy: number;
}
