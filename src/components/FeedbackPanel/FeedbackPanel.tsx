import type { LessonFeedback } from "../../models/lesson";
import type { FingerName, PoseAnalysisResult } from "../../models/poseAnalysis";
import { FINGER_NAMES } from "../../models/poseAnalysis";
import { classNames } from "../../utils/classNames";
import styles from "./FeedbackPanel.module.css";

export interface FeedbackPanelProps {
  feedback?: LessonFeedback;
  /** Part A's structured result (from usePoseFeedback) — renders per-finger chips when present. */
  poseAnalysis?: PoseAnalysisResult | null;
  /** Part B's phrased sentence (template or LLM) — takes priority over `feedback.message` when present. */
  phrasedMessage?: string | null;
  /** True while the on-device LLM is generating a phrased upgrade of the current template message. */
  isPhrasingLoading?: boolean;
}

const DEFAULT_FEEDBACK: LessonFeedback = {
  status: "idle",
  message: "Perform the sign in view of the camera to get feedback.",
};

const FINGER_LABEL: Record<FingerName, string> = {
  thumb: "Thumb",
  index: "Index",
  middle: "Middle",
  ring: "Ring",
  pinky: "Pinky",
};

/**
 * Displays real-time feedback about the user's sign attempt: a headline
 * message (LLM-phrased when available, template-based otherwise) plus, once
 * a target letter is being analyzed, a finger-by-finger correctness readout.
 */
export function FeedbackPanel({
  feedback = DEFAULT_FEEDBACK,
  poseAnalysis,
  phrasedMessage,
  isPhrasingLoading,
}: FeedbackPanelProps) {
  const status = poseAnalysis ? (poseAnalysis.isCorrect ? "correct" : "incorrect") : feedback.status;
  const message = phrasedMessage ?? feedback.message;

  return (
    <section className={styles.panel} role="status" aria-live="polite">
      <div className={styles.headline}>
        <span className={styles.dot} data-status={status} aria-hidden="true" />
        <p className={styles.message}>{message}</p>
        {isPhrasingLoading && (
          <span className={styles.phrasingHint} aria-hidden="true">
            refining…
          </span>
        )}
      </div>

      {poseAnalysis && (
        <ul className={styles.fingerList}>
          {FINGER_NAMES.map((finger) => {
            const info = poseAnalysis.fingers[finger];
            return (
              <li
                key={finger}
                className={classNames(styles.fingerChip)}
                data-status={info.status}
                title={info.status === "incorrect" ? `Expected ${info.expected}, currently ${info.state}` : undefined}
              >
                {FINGER_LABEL[finger]}
              </li>
            );
          })}
          {poseAnalysis.palm.status !== "not_checked" && (
            <li className={styles.fingerChip} data-status={poseAnalysis.palm.status}>
              Palm
            </li>
          )}
        </ul>
      )}
    </section>
  );
}
