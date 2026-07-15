import type { HandLandmarks, Handedness } from "../models/handTracking";
import type {
  ExtensionState,
  FingerAnalysis,
  FingerIssue,
  FingerName,
  PalmAnalysis,
  PalmIssue,
  PoseAnalysisResult,
  RollDirection,
  WristRollAnalysis,
} from "../models/poseAnalysis";
import { FINGER_JOINT_INDICES, FINGER_NAMES } from "../models/poseAnalysis";
import { ASL_ALPHABET_REFERENCE } from "../models/aslAlphabetReference";
import { angleBetween, cross, mirrorHorizontally, signedAngleFromVertical } from "../utils/handGeometry";


/** Joint-angle thresholds separating curled / halfCurled / extended, in degrees. Tune per finger if needed. */
const EXTENDED_MIN_ANGLE = 155;
const CURLED_MAX_ANGLE = 95;

/** Beyond this angleDiff (degrees), a finger's matchPercent bottoms out at 0. */
const MAX_ANGLE_DIFF_FOR_ZERO_SCORE = 90;

/** Default sensitivity when no threshold is supplied — matches the slider's default in useAccuracyThreshold. */
const DEFAULT_ACCURACY_THRESHOLD = 80;

/** Wrist roll (degrees from vertical) below this is considered upright — generous, since a slight natural tilt is normal. */
const ROLL_TOLERANCE_DEGREES = 18;
/** Beyond this, phrase the nudge as "more" rather than "slightly". */
const ROLL_SIGNIFICANT_DEGREES = 40;

function classifyExtension(angle: number): ExtensionState {
  if (angle >= EXTENDED_MIN_ANGLE) return "extended";
  if (angle <= CURLED_MAX_ANGLE) return "curled";
  return "halfCurled";
}

/** Midpoint of the angle range a given bucket occupies — used to compute a signed diff for ranking severity. */
function bucketCenter(state: ExtensionState): number {
  if (state === "extended") return 180;
  if (state === "curled") return 0;
  return (EXTENDED_MIN_ANGLE + CURLED_MAX_ANGLE) / 2;
}

function classifyFingerIssue(current: ExtensionState, expected: ExtensionState): FingerIssue {
  const currentRank = { curled: 0, halfCurled: 1, extended: 2 }[current];
  const expectedRank = { curled: 0, halfCurled: 1, extended: 2 }[expected];
  if (currentRank > expectedRank) return "too_straight";
  if (currentRank < expectedRank) return "too_bent";
  return "partially_bent";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** 100 at angleDiff=0, sliding to 0 at MAX_ANGLE_DIFF_FOR_ZERO_SCORE and beyond. */
function matchPercentFromAngleDiff(angleDiff: number): number {
  return Math.round(clamp(100 * (1 - angleDiff / MAX_ANGLE_DIFF_FOR_ZERO_SCORE), 0, 100));
}

/**
 * PoseAnalysisService
 *
 * Part A of the Stage 6 hybrid tutor: pure, deterministic geometry —
 * no ML, no LLM. Compares live landmarks against a target letter's
 * expected hand shape (ASL_ALPHABET_REFERENCE) and returns a structured
 * breakdown of what's right and wrong, finger by finger.
 *
 * Deliberately independent of SignClassifierService/LandmarkProcessor:
 * this operates on raw landmarks straight from HandTrackingService, not
 * the normalized 63-value ML feature vector, since joint angles need the
 * original per-point geometry.
 */
export class PoseAnalysisService {
  /**
   * Runs the full comparison against a target letter and returns Part A's
   * structured result.
   *
   * @param thresholdPercent user-adjustable sensitivity (0-100, default 80)
   *   — how close (by accuracyPercent) counts as "correct". Lower = more
   *   forgiving, higher = stricter. Applied uniformly to each finger's own
   *   status and to the overall isCorrect verdict.
   */
  static analyze(
    landmarks: HandLandmarks,
    handedness: Handedness | null,
    targetLetter: string,
    thresholdPercent: number = DEFAULT_ACCURACY_THRESHOLD
  ): PoseAnalysisResult {
    const letter = targetLetter.toUpperCase();
    const reference = ASL_ALPHABET_REFERENCE[letter];
    if (!reference) {
      throw new Error(`No ASL reference data for letter "${targetLetter}".`);
    }

    // Canonicalize handedness the same way LandmarkProcessor does, so the
    // same reference table works regardless of which hand is signing.
    const points = handedness === "Left" ? mirrorHorizontally(landmarks) : landmarks;

    const fingers = {} as Record<FingerName, FingerAnalysis>;
    for (const finger of FINGER_NAMES) {
      fingers[finger] = PoseAnalysisService.analyzeFinger(points, finger, reference.fingers[finger], thresholdPercent);
    }

    const palm = PoseAnalysisService.analyzePalm(points, reference.palmOrientation);
    const wristRoll = PoseAnalysisService.analyzeWristRoll(points);

    const fingerScores = FINGER_NAMES.map((f) => fingers[f].matchPercent);
    const palmScore = palm.status === "not_checked" ? null : palm.status === "correct" ? 100 : 0;
    const allScores = palmScore === null ? fingerScores : [...fingerScores, palmScore];
    const accuracyPercent = Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length);

    const isCorrect = accuracyPercent >= thresholdPercent;

    return { letter, fingers, palm, wristRoll, accuracyPercent, accuracyThreshold: thresholdPercent, isCorrect };
  }

  private static analyzeFinger(
    landmarks: HandLandmarks,
    finger: FingerName,
    expected: ExtensionState,
    thresholdPercent: number
  ): FingerAnalysis {
    const [mcpIdx, pipIdx, dipIdx, tipIdx] = FINGER_JOINT_INDICES[finger];
    const mcp = landmarks[mcpIdx];
    const pip = landmarks[pipIdx];
    const dip = landmarks[dipIdx];
    const tip = landmarks[tipIdx];

    // Average the two knuckle-flexion angles along the finger. For the
    // thumb (no true DIP joint) this reuses IP for both, which still
    // captures its one meaningful bend.
    const angleAtPip = angleBetween(mcp, pip, dip);
    const angleAtDip = angleBetween(pip, dip, tip);
    const angle = (angleAtPip + angleAtDip) / 2;

    const state = classifyExtension(angle);
    const angleDiff = Math.round(Math.abs(angle - bucketCenter(expected)));
    const matchPercent = matchPercentFromAngleDiff(angleDiff);

    if (matchPercent >= thresholdPercent) {
      return { state, angle: Math.round(angle), expected, status: "correct", angleDiff, matchPercent };
    }

    return {
      state,
      angle: Math.round(angle),
      expected,
      status: "incorrect",
      issue: classifyFingerIssue(state, expected),
      angleDiff,
      matchPercent,
    };
  }

  /**
   * Approximates which way the palm faces using the plane formed by the
   * wrist and the index/pinky MCP knuckles. The cross product's z-component
   * sign roughly tracks whether the palm plane tilts toward or away from
   * the camera in MediaPipe's image-normalized coordinate space.
   *
   * This is a coarse heuristic (facingCamera vs. facingAway only) — see
   * the LetterReference doc-comment for why sideways/downward letters
   * leave palmOrientation unchecked rather than risk a confidently wrong
   * heuristic there.
   */
  private static analyzePalm(landmarks: HandLandmarks, expected?: "facingCamera" | "facingAway"): PalmAnalysis {
    if (!expected) {
      return { orientation: "unknown", status: "not_checked" };
    }

    const wrist = landmarks[0];
    const indexMcp = landmarks[5];
    const pinkyMcp = landmarks[17];

    const v1 = { x: indexMcp.x - wrist.x, y: indexMcp.y - wrist.y, z: indexMcp.z - wrist.z };
    const v2 = { x: pinkyMcp.x - wrist.x, y: pinkyMcp.y - wrist.y, z: pinkyMcp.z - wrist.z };
    const normal = cross(v1, v2);

    const orientation: "facingCamera" | "facingAway" = normal.z > 0 ? "facingCamera" : "facingAway";

    if (orientation === expected) {
      return { orientation, status: "correct" };
    }

    const issue: PalmIssue = expected === "facingCamera" ? "flip_toward_camera" : "flip_away_from_camera";
    return { orientation, status: "incorrect", issue };
  }

  /**
   * Estimates how tilted the hand looks on screen (roll about the forearm
   * axis) and, if it's off enough to matter, which way to rotate the wrist
   * to correct it — e.g. "rotate wrist slightly clockwise".
   *
   * Uses the wrist->middle-MCP vector as the hand's long axis: unlike
   * fingertips, the MCP knuckles barely move as fingers curl, so this stays
   * stable across every finger shape and isolates rotation specifically.
   * Checked against upright (0deg) for every letter, since fingerspelling
   * is conventionally signed with the hand vertical — this is a coarse,
   * letter-independent heuristic, not tuned per letter.
   */
  private static analyzeWristRoll(landmarks: HandLandmarks): WristRollAnalysis {
    const wrist = landmarks[0];
    const middleMcp = landmarks[9];

    const angle = signedAngleFromVertical({ x: middleMcp.x - wrist.x, y: middleMcp.y - wrist.y });
    const rounded = Math.round(angle);

    if (Math.abs(angle) <= ROLL_TOLERANCE_DEGREES) {
      return { angle: rounded, status: "correct" };
    }

    // To straighten a clockwise tilt, rotate counterclockwise, and vice versa.
    const correctionDirection: RollDirection = angle > 0 ? "counterclockwise" : "clockwise";
    const magnitude: "slightly" | "more" = Math.abs(angle) >= ROLL_SIGNIFICANT_DEGREES ? "more" : "slightly";

    return { angle: rounded, status: "incorrect", correctionDirection, magnitude };
  }
}
