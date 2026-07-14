/**
 * Domain types for finger-level pose analysis and tutor feedback.
 * Kept separate from handTracking.ts (raw detection) and
 * landmarkProcessing.ts (ML feature extraction) since this describes a
 * third, independent consumer of raw landmarks: rule-based comparison
 * against a target letter's expected hand shape.
 */

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

export const FINGER_NAMES: readonly FingerName[] = ["thumb", "index", "middle", "ring", "pinky"];

/** How bent a finger is, bucketed from its joint angle. */
export type ExtensionState = "extended" | "halfCurled" | "curled";

/** Why a finger's current state doesn't match the target letter's expected state. */
export type FingerIssue = "too_straight" | "too_bent" | "partially_bent";

export interface FingerAnalysis {
  /** Detected extension bucket for this finger right now. */
  state: ExtensionState;
  /** Averaged joint angle in degrees (180 = fully straight, ~0 = fully curled). */
  angle: number;
  /** What the target letter expects for this finger. */
  expected: ExtensionState;
  status: "correct" | "incorrect";
  issue?: FingerIssue;
  /**
   * How far off the current angle is from the nearest edge of the expected
   * bucket's range, in degrees. 0 when correct. Used to rank which finger
   * issues matter most (e.g. for an LLM/UI to prioritize the worst offender).
   */
  angleDiff: number;
}

/**
 * A hand only has a meaningful facing direction relative to the camera —
 * unlike fingers, this isn't checked for every letter (see LetterReference).
 */
export type PalmOrientation = "facingCamera" | "facingAway" | "unknown";

export type PalmIssue = "flip_toward_camera" | "flip_away_from_camera";

export interface PalmAnalysis {
  orientation: PalmOrientation;
  /** "not_checked" when the target letter has no orientation expectation set. */
  status: "correct" | "incorrect" | "not_checked";
  issue?: PalmIssue;
}

/** Which way to rotate the wrist to correct an on-screen tilt. */
export type RollDirection = "clockwise" | "counterclockwise";

/**
 * Roll of the hand about the forearm axis — i.e. how tilted it looks on
 * screen, independent of palmOrientation's front/back facing check.
 * Checked against "upright" (0deg) for every letter, since fingerspelling
 * is conventionally signed with the hand vertical.
 */
export interface WristRollAnalysis {
  /** Signed tilt from vertical in degrees. Positive = tilted clockwise. */
  angle: number;
  status: "correct" | "incorrect";
  /** Present only when status is "incorrect". */
  correctionDirection?: RollDirection;
  /** Coarse severity used to phrase feedback ("slightly" vs a stronger nudge). */
  magnitude?: "slightly" | "more";
}

/**
 * Part A output — the deterministic PoseAnalysisService result. Plain data,
 * safe to serialize and hand to an LLM, a UI component, or a test assertion.
 */
export interface PoseAnalysisResult {
  letter: string;
  fingers: Record<FingerName, FingerAnalysis>;
  palm: PalmAnalysis;
  wristRoll: WristRollAnalysis;
  /**
   * True only when every finger is correct AND palm is correct-or-not-checked.
   * Deliberately does NOT factor in wristRoll — roll tolerance is generous
   * and advisory only, so it doesn't gate the "isCorrect" verdict.
   */
  isCorrect: boolean;
}

/**
 * Reference hand-shape data per target letter, used by PoseAnalysisService
 * to know what "correct" looks like.
 *
 * IMPORTANT — this is a v1 approximation of the ASL manual alphabet, meant
 * to be tunable. Two known simplifications:
 *  1. Letters that differ mainly by thumb placement relative to the palm
 *     (M vs N vs S vs T) are hard to fully disambiguate from extension
 *     state alone — thumb is "curled" in all of them. Treat feedback for
 *     these letters as a starting point, not gospel.
 *  2. palmOrientation is left `undefined` (not checked) for letters whose
 *     conventional orientation is sideways/downward (e.g. G, H, P, Q) or
 *     motion-based (J, Z as static frames) rather than camera-facing —
 *     encoding those confidently would need more geometry than the simple
 *     facingCamera/facingAway split below supports.
 */
export interface LetterReference {
  fingers: Record<FingerName, ExtensionState>;
  /** Omit entirely when orientation isn't confidently checkable for this letter (see class doc above). "unknown" is never a valid expectation, only a possible detected value. */
  palmOrientation?: Exclude<PalmOrientation, "unknown">;
}
