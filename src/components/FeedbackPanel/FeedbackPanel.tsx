import type { LessonFeedback } from "../../models/lesson";
import styles from "./FeedbackPanel.module.css";

export interface FeedbackPanelProps {
  feedback?: LessonFeedback;
}

const DEFAULT_FEEDBACK: LessonFeedback = {
  status: "idle",
  message: "Perform the sign in view of the camera to get feedback.",
};

/**
 * Displays real-time feedback about the user's sign attempt.
 * Structural placeholder — no AI evaluation is wired up yet.
 */
export function FeedbackPanel({ feedback = DEFAULT_FEEDBACK }: FeedbackPanelProps) {
  return (
    <section className={styles.panel} role="status" aria-live="polite">
      <span className={styles.dot} data-status={feedback.status} aria-hidden="true" />
      <p className={styles.message}>{feedback.message}</p>
    </section>
  );
}
