import type { Lesson } from "../../models/lesson";
import styles from "./LessonPanel.module.css";

export interface LessonPanelProps {
  lesson?: Lesson;
}

/**
 * Displays the currently selected lesson's instructions.
 * Structural placeholder — no recognition/scoring logic yet.
 */
export function LessonPanel({ lesson }: LessonPanelProps) {
  if (!lesson) {
    return (
      <section className={styles.panel}>
        <p className={styles.eyebrow}>Current lesson</p>
        <p className={styles.description}>Select a lesson from the sidebar to get started.</p>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <p className={styles.eyebrow}>Current lesson · {lesson.difficulty}</p>
      <h2 className={styles.signName}>{lesson.signName}</h2>
      <p className={styles.description}>{lesson.description}</p>
    </section>
  );
}
