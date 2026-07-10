import type { Lesson } from "../../models/lesson";
import styles from "./Sidebar.module.css";

export interface SidebarProps {
  lessons?: Pick<Lesson, "id" | "title">[];
  activeLessonId?: string;
}

/**
 * Lesson navigation list. Structural placeholder — will read from a
 * real lesson data source once that layer exists.
 */
export function Sidebar({ lessons = [], activeLessonId }: SidebarProps) {
  return (
    <nav className={styles.sidebar} aria-label="Lessons">
      <p className={styles.heading}>Lessons</p>
      {lessons.length === 0 && <p className={styles.item}>No lessons loaded yet.</p>}
      {lessons.map((lesson) => (
        <div
          key={lesson.id}
          className={lesson.id === activeLessonId ? styles.itemActive : styles.item}
        >
          {lesson.title}
        </div>
      ))}
    </nav>
  );
}
