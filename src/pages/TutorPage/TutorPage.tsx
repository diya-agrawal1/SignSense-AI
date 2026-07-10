import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import styles from "./TutorPage.module.css";

/**
 * Main tutoring screen. Wires the reusable components together with
 * placeholder data — lesson content and AI feedback will be connected
 * once those layers are implemented.
 */
export function TutorPage() {
  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.body}>
        <Sidebar lessons={[]} />

        <main className={styles.main}>
          <div className={styles.stage}>
            <Camera />
            <SkeletonCanvas />
          </div>
          <LessonPanel />
        </main>

        <div className={styles.right}>
          <FeedbackPanel />
        </div>
      </div>
    </div>
  );
}
