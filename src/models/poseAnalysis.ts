/**
 * Domain types for finger-level pose analysis and tutor feedback.
 * Kept separate from handTracking.ts (raw detection) and
 * landmarkProcessing.ts (ML feature extraction) since this describes a
 * third, independent consumer of raw landmarks: rule-based comparison
 * against a target letter's expected hand shape.
 */

export type FingerName = "thumb" | "index" | "middle" | "ring" | "pinky";

export const FINGER_NAMES: readonly FingerName[] = ["thumb", "index", "middle", "ring", "pinky"];

/**
 * Landmark indices per finger: [MCP, PIP, DIP, TIP]. Thumb has no true DIP
 * joint, so it reuses IP for both the "pip" and "dip" slots — same
 * convention PoseAnalysisService's angle math and SkeletonCanvas's ghost
 * overlay both rely on.
 */
export const FINGER_JOINT_INDICES: Record<FingerName, readonly [number, number, number, number]> = {
  thumb: [1, 2, 3, 4], // CMC, MCP, IP, TIP
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
};

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
  /** Whether matchPercent clears the user's accuracy threshold (see PoseAnalysisResult.accuracyPercent). */
  status: "correct" | "incorrect";
  issue?: FingerIssue;
  /**
   * How far off the current angle is from the expected bucket's center, in
   * degrees. Always computed (not just when incorrect) — it's the raw input
   * to matchPercent below.
   */
  angleDiff: number;
  /** 0-100 closeness to the expected shape for this finger alone. 100 = dead center of the expected bucket. */
  matchPercent: number;
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
   * 0-100 overall closeness to the target letter's shape: the average of
   * all 5 fingers' matchPercent, plus palm's (100 correct / 0 incorrect)
   * when the letter has a checked orientation. Does NOT factor in
   * wristRoll — roll tolerance is generous and advisory only.
   */
  accuracyPercent: number;
  /** The sensitivity this result was judged against — see PoseAnalysisService.analyze's thresholdPercent param. */
  accuracyThreshold: number;
  /**
   * True when accuracyPercent >= accuracyThreshold. Because this is judged
   * on the OVERALL average, it's possible for isCorrect to be true while
   * one individual finger's own status is "incorrect" (a strong match
   * elsewhere can outweigh one weak finger) — that's intentional, not a
   * bug: the accuracy threshold is a single adjustable sensitivity dial,
   * not a require-every-finger-individually gate.
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
