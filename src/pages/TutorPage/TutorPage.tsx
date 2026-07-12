import { useState, useEffect } from "react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import { useHandTracking } from "../../hooks/useHandTracking";
import styles from "./TutorPage.module.css";
import { LandmarkProcessor } from "../../services/LandmarkProcessor";
/**
 * Main tutoring screen. Wires the reusable components together with
 * placeholder data — lesson content and AI feedback will be connected
 * once those layers are implemented.
 */
export function TutorPage() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const { landmarks, fps } = useHandTracking(video);

  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.body}>
        <Sidebar lessons={[]} />

        <main className={styles.main}>
          <div className={styles.stage}>
            <Camera onReady={setVideo} />
            <SkeletonCanvas landmarks={landmarks} fps={fps} />
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
