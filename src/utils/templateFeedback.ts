import type { FingerIssue, FingerName, PoseAnalysisResult } from "../models/poseAnalysis";
import { FINGER_NAMES } from "../models/poseAnalysis";

const FRIENDLY_FINGER: Record<FingerName, string> = {
  thumb: "your thumb",
  index: "your index finger",
  middle: "your middle finger",
  ring: "your ring finger",
  pinky: "your pinky",
};

/** Short, capitalized label for structured (list-style) feedback lines. */
const FINGER_LABEL: Record<FingerName, string> = {
  thumb: "Thumb",
  index: "Index finger",
  middle: "Middle finger",
  ring: "Ring finger",
  pinky: "Pinky",
};

const ISSUE_LABEL: Record<FingerIssue, string> = {
  too_straight: "too straight",
  too_bent: "too bent",
  partially_bent: "partially bent",
};

/**
 * Builds one short, deterministic line per finger/palm/wrist check straight
 * from Part A's structured result — e.g. "Thumb correct", "Index finger too
 * bent", "Rotate wrist slightly clockwise". No model involved; pure
 * string formatting over PoseAnalysisResult, safe to render as a checklist
 * or read out one at a time.
 */
export function generateStructuredFeedback(result: PoseAnalysisResult): string[] {
  const lines: string[] = [];

  for (const finger of FINGER_NAMES) {
    const info = result.fingers[finger];
    const label = FINGER_LABEL[finger];
    lines.push(info.status === "correct" ? `${label} correct` : `${label} ${ISSUE_LABEL[info.issue!]}`);
  }

  if (result.palm.status === "correct") {
    lines.push("Palm orientation correct");
  } else if (result.palm.status === "incorrect") {
    const hint = result.palm.issue === "flip_toward_camera" ? "toward the camera" : "away from the camera";
    lines.push(`Turn palm ${hint}`);
  }

  if (result.wristRoll.status === "incorrect") {
    lines.push(`Rotate wrist ${result.wristRoll.magnitude} ${result.wristRoll.correctionDirection}`);
  }

  return lines;
}

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
