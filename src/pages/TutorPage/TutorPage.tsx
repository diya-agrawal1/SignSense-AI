import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Header } from "../../components/Header";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSignClassifier } from "../../hooks/useSignClassifier";
import { usePoseFeedback } from "../../hooks/usePoseFeedback";
import { useSessionStats } from "../../hooks/useSessionStats";
import { ProgressService } from "../../services/ProgressService";
import { LessonEngine } from "../../services/LessonEngine";
import type { ProgressState } from "../../models/progress";
import type { PoseAnalysisResult } from "../../models/poseAnalysis";
import type { NextLetterResult, SpellingExercise } from "../../models/lessonEngine";
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
 * LessonEngine is the single source of truth for "what should the learner
 * practice right now": `target` is always a real NextLetterResult from it
 * (seeded on mount, replaced after every correct attempt), and both the
 * Sidebar dashboard and LessonPanel just render that same value plus the
 * ProgressService state it was derived from - no separate placeholder
 * lesson data lives in this component anymore.
 *
 * Live sign classification (SignClassifierService) and pose feedback
 * (PoseAnalysisService + LLMFeedbackService, Stage 6) both run off the same
 * tracked landmarks: the classifier answers "what letter is this?" while
 * pose feedback answers "how do I fix my {targetLetter}?" - kept as two
 * independent consumers per the stage-by-stage architecture.
 */
export interface TutorPageProps {
  /** Returns to the Home screen. Also tears down the camera/model instances via each hook's own unmount cleanup. */
  onExit?: () => void;
}

export function TutorPage({ onExit }: TutorPageProps) {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const { landmarks, fps, handedness } = useHandTracking(video);
  const { letter, confidence, isModelReady } = useSignClassifier(landmarks, handedness);
  const { score, streak: sessionCombo, recordResult } = useSessionStats();

  // Mirrors LocalStorage: seeded from ProgressService on mount, then
  // replaced with whatever ProgressService.recordAttempt returns after
  // each attempt. Sidebar's accuracy/streak/weak-letter/unlocked-tier
  // readout all derive from this single value instead of re-reading
  // storage on every render.
  const [progress, setProgress] = useState<ProgressState>(() => ProgressService.getProgress());

  // LessonEngine's current pick. Seeded on mount so a target letter always
  // exists as soon as TutorPage opens - never a hardcoded default.
  const [target, setTarget] = useState<NextLetterResult>(() => LessonEngine.getNextLetter(progress));

  // Reset each time the target letter changes, so response time reflects
  // "how long since the user started attempting this letter" rather than
  // running continuously across letter switches.
  const attemptStartRef = useRef(Date.now());
  useEffect(() => {
    attemptStartRef.current = Date.now();
  }, [target.letter]);

  const [spellingExercise, setSpellingExercise] = useState<SpellingExercise | null>(null);

  const recordAttempt = useCallback(
    (result: PoseAnalysisResult) => {
      const responseTimeMs = Date.now() - attemptStartRef.current;
      const updated = ProgressService.recordAttempt(result.letter, result.isCorrect, responseTimeMs);
      // Next hold's response time should be measured from now, not from the original attempt start.
      attemptStartRef.current = Date.now();
      setProgress(updated);

      // Session score/combo streak: purely live UI feedback, kept separate
      // from ProgressService's persisted daily streak (see useSessionStats).
      recordResult(result.isCorrect);

      // Advance to a new target only once the current one is nailed — staying
      // put on a miss is what lets weak-letter prioritization actually mean
      // something (repetition on the letter that was just gotten wrong), and
      // is also why "incorrect" naturally keeps giving live corrective
      // feedback on the same letter rather than moving on. LessonEngine
      // decides the next letter; this component never invents one itself.
      if (result.isCorrect) {
        setTarget(LessonEngine.getNextLetter(updated, result.letter));
        setSpellingExercise(LessonEngine.generateSpellingExercise(updated));
      }
    },
    [recordResult]
  );

  // Manual override: still routed through LessonEngine for the difficulty
  // lookup so Sidebar/LessonPanel never see a fabricated difficulty value.
  const handleManualSelect = useCallback((letterChoice: string) => {
    setTarget({
      letter: letterChoice,
      difficulty: LessonEngine.getDifficultyForLetter(letterChoice),
      reason: "manual",
    });
  }, []);

  const { analysis, structuredFeedback, message, isPhrasingLoading, isLLMAvailable } = usePoseFeedback(
    landmarks,
    handedness,
    target.letter,
    recordAttempt
  );

  const accuracy = useMemo(() => ProgressService.getAccuracy(progress), [progress]);
  const weakLetters = useMemo(() => ProgressService.getWeakLetters(progress), [progress]);
  const dailyStreak = useMemo(() => ProgressService.getStreak(progress).current, [progress]);
  const unlockedDifficulty = useMemo(() => LessonEngine.getUnlockedDifficulty(progress), [progress]);

  const detectionCaption = letter
    ? `Classifier detects: ${letter} (${Math.round((confidence ?? 0) * 100)}%)`
    : isModelReady
      ? "Classifier: no confident match yet."
      : "Loading sign classifier...";

  return (
    <div className={styles.layout}>
      <Header score={score} streak={sessionCombo} onHome={onExit} />
      <div className={styles.body}>
        <Sidebar
          targetLetter={target.letter}
          difficulty={target.difficulty}
          accuracy={accuracy}
          sessionCombo={sessionCombo}
          dailyStreak={dailyStreak}
          weakLetters={weakLetters}
          unlockedDifficulty={unlockedDifficulty}
        />

        <main className={styles.main}>
          <div className={styles.stage}>
            <Camera onReady={setVideo} />
            <SkeletonCanvas landmarks={landmarks} poseAnalysis={analysis} fps={fps} />
          </div>
          <LetterPicker value={target.letter} onChange={handleManualSelect} />
          <LessonPanel target={target} />
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
