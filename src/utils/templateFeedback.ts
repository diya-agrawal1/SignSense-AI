import type { FingerName, PoseAnalysisResult } from "../models/poseAnalysis";
import { FINGER_NAMES } from "../models/poseAnalysis";

const FRIENDLY_FINGER: Record<FingerName, string> = {
  thumb: "your thumb",
  index: "your index finger",
  middle: "your middle finger",
  ring: "your ring finger",
  pinky: "your pinky",
};

/**
 * Builds simple, fixed-template feedback straight from Part A's structured
 * result — no model involved. Used as the instant fallback when WebGPU is
 * unavailable, the LLM fails to load, or inference times out, and as the
 * first-paint message while the LLM phrasing streams in.
 */
export function generateTemplateFeedback(result: PoseAnalysisResult): string {
  if (result.isCorrect) {
    return `Nice! That's a clean ${result.letter}.`;
  }

  const incorrectFingers = FINGER_NAMES.filter((f) => result.fingers[f].status === "incorrect").sort(
    (a, b) => result.fingers[b].angleDiff - result.fingers[a].angleDiff
  );

  const parts: string[] = [];

  const worst = incorrectFingers[0];
  if (worst) {
    const issue = result.fingers[worst].issue;
    const action = issue === "too_straight" ? "curl it more" : "straighten it more";
    parts.push(`Try to ${action} — ${FRIENDLY_FINGER[worst]} looks ${issue === "too_straight" ? "too extended" : "too bent"}.`);
  }

  if (result.palm.status === "incorrect") {
    const hint = result.palm.issue === "flip_toward_camera" ? "toward the camera" : "away from the camera";
    parts.push(`Turn your palm ${hint}.`);
  }

  return parts.length > 0 ? parts.join(" ") : `Almost there — keep adjusting your ${result.letter}.`;
}
