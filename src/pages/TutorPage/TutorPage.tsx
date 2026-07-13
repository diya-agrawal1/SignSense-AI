import { useState } from "react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSignClassifier } from "../../hooks/useSignClassifier";
import type { LessonFeedback } from "../../models/lesson";
import styles from "./TutorPage.module.css";

/**
 * Main tutoring screen. Wires the reusable components together with
 * placeholder data — lesson content will be connected once that layer
 * is implemented. Live sign classification is wired up: FeedbackPanel
 * currently just echoes the model's raw prediction rather than
 * comparing it against a target sign, since there's no lesson selected
 * yet to compare against.
 */
export function TutorPage() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const { landmarks, fps, handedness } = useHandTracking(video);
  const { letter, confidence, isModelReady } = useSignClassifier(landmarks, handedness);

  const feedback: LessonFeedback = letter
    ? {
        status: "evaluating",
        message: `Detected sign: ${letter} (${Math.round((confidence ?? 0) * 100)}% confidence)`,
      }
    : {
        status: "idle",
        message: isModelReady
          ? "Perform the sign in view of the camera to get feedback."
          : "Loading sign classifier…",
      };

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
          <FeedbackPanel feedback={feedback} />
        </div>
      </div>
    </div>
  );
}
