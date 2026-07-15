import { useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSignClassifier } from "../../hooks/useSignClassifier";
import { usePoseFeedback } from "../../hooks/usePoseFeedback";
import { useProgressTracking } from "../../hooks/useProgressTracking";
import { useAccuracyThreshold, MIN_ACCURACY_THRESHOLD, MAX_ACCURACY_THRESHOLD } from "../../hooks/useAccuracyThreshold";
import type { Lesson } from "../../models/lesson";
import { classNames } from "../../utils/classNames";
import styles from "./TutorPage.module.css";

const ASL_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/**
 * Temporary target-letter picker. Stands in for real lesson selection
 * (Stage 10 territory: the adaptive lesson engine isn't built yet) so
 * PoseAnalysisService/usePoseFeedback/useProgressTracking have a target to
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
 * User-adjustable "how close counts as correct" sensitivity dial. Lower =
 * more forgiving (e.g. 80% average closeness across fingers/palm passes),
 * higher = stricter (95% demands a near-exact match). Persisted via
 * useAccuracyThreshold so it carries over between sessions.
 */
function AccuracyThresholdControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className={styles.thresholdControl}>
      <label htmlFor="accuracy-threshold" className={styles.thresholdLabel}>
        Accuracy sensitivity: <span className={styles.thresholdValue}>{value}%</span>
      </label>
      <input
        id="accuracy-threshold"
        type="range"
        min={MIN_ACCURACY_THRESHOLD}
        max={MAX_ACCURACY_THRESHOLD}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={styles.thresholdSlider}
        aria-describedby="accuracy-threshold-hint"
      />
      <p id="accuracy-threshold-hint" className={styles.thresholdHint}>
        Signs need to match at least this closely to count as correct. Lower it if signs that look right aren't
        registering; raise it for stricter practice.
      </p>
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
 *
 * useProgressTracking (Stage 9) is a silent third consumer of `analysis` —
 * it doesn't render anything here, just persists round outcomes so the
 * Dashboard screen has real data to show. accuracyThreshold (also Stage 9)
 * feeds into PoseAnalysisService itself, so it affects isCorrect
 * everywhere at once: the skeleton highlight, the feedback panel, and what
 * counts as a "success" for progress tracking.
 */
export function TutorPage() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [targetLetter, setTargetLetter] = useState("A");
  const [accuracyThreshold, setAccuracyThreshold] = useAccuracyThreshold();
  const { landmarks, fps, handedness } = useHandTracking(video);
  const { letter, confidence, isModelReady } = useSignClassifier(landmarks, handedness);
  const { analysis, structuredFeedback, message, isPhrasingLoading, isLLMAvailable } = usePoseFeedback(
    landmarks,
    handedness,
    targetLetter,
    accuracyThreshold
  );
  useProgressTracking(targetLetter, analysis);

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
    <div className={styles.body}>
      <Sidebar lessons={[]} />

      <main className={styles.main}>
        <div className={styles.stage}>
          <Camera onReady={setVideo} />
          <SkeletonCanvas landmarks={landmarks} poseAnalysis={analysis} fps={fps} />
        </div>
        <LetterPicker value={targetLetter} onChange={setTargetLetter} />
        <LessonPanel lesson={activeLesson} />
      </main>

      <div className={styles.right}>
        <FeedbackPanel
          feedback={{ status: analysis ? "evaluating" : "idle", message: detectionCaption }}
          poseAnalysis={analysis}
          structuredFeedback={structuredFeedback}
          phrasedMessage={message}
          isPhrasingLoading={isPhrasingLoading}
        />
        {!isLLMAvailable && <p className={styles.llmNotice}>On-device phrasing unavailable - using simple wording.</p>}
        <AccuracyThresholdControl value={accuracyThreshold} onChange={setAccuracyThreshold} />
      </div>
    </div>
  );
}
