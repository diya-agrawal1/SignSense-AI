import type { NextLetterReason, NextLetterResult } from "../../models/lessonEngine";
import styles from "./LessonPanel.module.css";

export interface LessonPanelProps {
  /** The engine's current pick — always present once TutorPage has mounted, since LessonEngine.getNextLetter() never returns nothing. */
  target: NextLetterResult;
}

const REASON_COPY: Record<NextLetterReason, string> = {
  weak_letter: "Revisiting a letter you've struggled with",
  new_letter: "New letter",
  reinforce: "Reinforcing practice",
  manual: "Manually selected",
};

/**
 * Shows what the adaptive lesson flow (LessonEngine) wants the learner to
 * practice right now: the target letter, its difficulty tier, why it was
 * chosen, and the practice instruction. Purely a view of TutorPage's
 * current `target` — no lesson data or selection logic lives here.
 */
export function LessonPanel({ target }: LessonPanelProps) {
  return (
    <section className={styles.panel}>
      <p className={styles.eyebrow}>Current target · {target.difficulty}</p>
      <h2 className={styles.signName}>{target.letter}</h2>
      <p className={styles.reason}>{REASON_COPY[target.reason]}</p>
      <p className={styles.description}>
        Hold the ASL sign for "{target.letter}" in view of the camera. Feedback will highlight which
        fingers still need adjusting.
      </p>
    </section>
  );
}
