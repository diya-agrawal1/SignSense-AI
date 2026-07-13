import { useState } from "react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSignClassifier } from "../../hooks/useSignClassifier";
import { usePoseFeedback } from "../../hooks/usePoseFeedback";
import type { Lesson } from "../../models/lesson";
import { classNames } from "../../utils/classNames";
import styles from "./TutorPage.module.css";

const ASL_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/**
 * Temporary target-letter picker. Stands in for real lesson selection
 * (Stage 9-11 territory: progress tracking + adaptive lesson engine aren't
 * built yet) so PoseAnalysisService/usePoseFeedback have a target to
 * compare against right now.
 */
function LetterPicker({ value, onChange }: { value: string; onChange: (letter: string) => void }) {
  return (
    <div className={styles.letterPicker} role="group" aria-label="Target letter">
      {ASL_LETTERS.map((letter) => (
        <button
          key={letter}
          type="button"
          className={classNames(styles.letterButton, letter === value && styles.letterButtonActive)}
          aria-pressed={letter === value}
          onClick={() => onChange(letter)}
        >
          {letter}
        </button>
      ))}
    </div>
  );
}

/**
 * Main tutoring screen. Wires the reusable components together.
 *
 * Live sign classification (SignClassifierService) and pose feedback
 * (PoseAnalysisService + LLMFeedbackService, Stage 6) both run off the same
 * tracked landmarks: the classifier answers "what letter is this?" while
 * pose feedback answers "how do I fix my {targetLetter}?" - kept as two
 * independent consumers per the stage-by-stage architecture.
 */
export function TutorPage() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [targetLetter, setTargetLetter] = useState("A");
  const { landmarks, fps, handedness } = useHandTracking(video);
  const { letter, confidence, isModelReady } = useSignClassifier(landmarks, handedness);
  const { analysis, message, isPhrasingLoading, isLLMAvailable } = usePoseFeedback(
    landmarks,
    handedness,
    targetLetter
  );

  const activeLesson: Lesson = {
    id: targetLetter,
    title: `Letter ${targetLetter}`,
    description: `Hold the ASL sign for "${targetLetter}" in view of the camera. Feedback will highlight which fingers still need adjusting.`,
    signName: targetLetter,
    difficulty: "beginner",
    completed: false,
  };

  const detectionCaption = letter
    ? `Classifier detects: ${letter} (${Math.round((confidence ?? 0) * 100)}%)`
    : isModelReady
      ? "Classifier: no confident match yet."
      : "Loading sign classifier...";

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
          <LetterPicker value={targetLetter} onChange={setTargetLetter} />
          <LessonPanel lesson={activeLesson} />
        </main>

        <div className={styles.right}>
          <FeedbackPanel
            feedback={{ status: analysis ? "evaluating" : "idle", message: detectionCaption }}
            poseAnalysis={analysis}
            phrasedMessage={message}
            isPhrasingLoading={isPhrasingLoading}
          />
          {!isLLMAvailable && <p className={styles.llmNotice}>On-device phrasing unavailable - using simple wording.</p>}
        </div>
      </div>
    </div>
  );
}
