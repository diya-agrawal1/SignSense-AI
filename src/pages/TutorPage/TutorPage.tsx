import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSignClassifier } from "../../hooks/useSignClassifier";
import { usePoseFeedback } from "../../hooks/usePoseFeedback";
import { ProgressService } from "../../services/ProgressService";
import { LessonEngine } from "../../services/LessonEngine";
import type { Lesson } from "../../models/lesson";
import type { PoseAnalysisResult } from "../../models/poseAnalysis";
import type { SpellingExercise } from "../../models/lessonEngine";
import { classNames } from "../../utils/classNames";
import styles from "./TutorPage.module.css";

const ASL_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/**
 * Manual target-letter override. LessonEngine picks the next letter
 * automatically after each correct hold, but this stays so the learner can
 * jump to a specific letter whenever they want.
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

  // Reset each time the target letter changes, so response time reflects
  // "how long since the user started attempting this letter" rather than
  // running continuously across letter switches.
  const attemptStartRef = useRef(Date.now());
  useEffect(() => {
    attemptStartRef.current = Date.now();
  }, [targetLetter]);

  const [spellingExercise, setSpellingExercise] = useState<SpellingExercise | null>(null);

  const recordAttempt = useCallback((result: PoseAnalysisResult) => {
    const responseTimeMs = Date.now() - attemptStartRef.current;
    const updated = ProgressService.recordAttempt(result.letter, result.isCorrect, responseTimeMs);
    // Next hold's response time should be measured from now, not from the original attempt start.
    attemptStartRef.current = Date.now();

    // Advance to a new target only once the current one is nailed — staying
    // put on a miss is what lets weak-letter prioritization actually mean
    // something (repetition on the letter that was just gotten wrong).
    if (result.isCorrect) {
      setTargetLetter(LessonEngine.getNextLetter(updated, result.letter).letter);
      setSpellingExercise(LessonEngine.generateSpellingExercise(updated));
    }
  }, []);

  const { analysis, structuredFeedback, message, isPhrasingLoading, isLLMAvailable } = usePoseFeedback(
    landmarks,
    handedness,
    targetLetter,
    recordAttempt
  );

  const activeLesson: Lesson = {
    id: targetLetter,
    title: `Letter ${targetLetter}`,
    description: `Hold the ASL sign for "${targetLetter}" in view of the camera. Feedback will highlight which fingers still need adjusting.`,
    signName: targetLetter,
    difficulty: LessonEngine.getDifficultyForLetter(targetLetter),
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
            <SkeletonCanvas landmarks={landmarks} poseAnalysis={analysis} fps={fps} />
          </div>
          <LetterPicker value={targetLetter} onChange={setTargetLetter} />
          <LessonPanel lesson={activeLesson} />
          {spellingExercise && (
            <p className={styles.llmNotice}>
              Nailed a few letters — try spelling "{spellingExercise.word}" next ({spellingExercise.difficulty}).
            </p>
          )}
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
        </div>
      </div>
    </div>
  );
}
