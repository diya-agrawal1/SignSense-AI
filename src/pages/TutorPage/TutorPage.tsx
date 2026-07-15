import { useEffect, useMemo, useState } from "react";
import { Sidebar } from "../../components/Sidebar";
import { LessonPanel } from "../../components/LessonPanel";
import { FeedbackPanel } from "../../components/FeedbackPanel";
import { DebugPanel } from "../../components/DebugPanel";
import { Camera } from "../../components/Camera";
import { SkeletonCanvas } from "../../components/SkeletonCanvas";
import { useHandTracking } from "../../hooks/useHandTracking";
import { useSignClassifier } from "../../hooks/useSignClassifier";
import { usePoseFeedback } from "../../hooks/usePoseFeedback";
import { useProgressTracking } from "../../hooks/useProgressTracking";
import { useLessonEngine } from "../../hooks/useLessonEngine";
import { ProgressService } from "../../services/ProgressService";
import { LessonEngine } from "../../services/LessonEngine";
import { useAccuracyThreshold, MIN_ACCURACY_THRESHOLD, MAX_ACCURACY_THRESHOLD } from "../../hooks/useAccuracyThreshold";
import type { Lesson } from "../../models/lesson";
import { classNames } from "../../utils/classNames";
import styles from "./TutorPage.module.css";

const ASL_LETTERS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/**
 * Manual override for LessonEngine's suggestion (Stage 10). The engine
 * drives `targetLetter` by default — prioritizing weak letters and
 * unlocking harder tiers gradually — but a learner can still jump to any
 * letter directly at any time; doing so doesn't fight the engine, it just
 * starts a fresh round on whatever they picked, same as always.
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
 * useProgressTracking (Stage 9) is a consumer of `analysis` that persists
 * round outcomes; useLessonEngine (Stage 10) reads those same persisted
 * stats back out and decides what to practice next — prioritizing weak
 * letters, unlocking harder tiers gradually, and occasionally suggesting a
 * short spelling exercise once enough letters are solid. `advance()` is
 * wired into useProgressTracking's `onRoundComplete`, so the engine only
 * re-evaluates exactly when a round actually finishes (success or
 * abandoned) rather than on some arbitrary timer. accuracyThreshold (also
 * Stage 9) feeds into PoseAnalysisService itself, so it affects isCorrect
 * everywhere at once: the skeleton highlight, the feedback panel, and what
 * counts as a "success" for progress tracking (and, transitively, for the
 * lesson engine's difficulty curve).
 */
export function TutorPage() {
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [accuracyThreshold, setAccuracyThreshold] = useAccuracyThreshold();
  const [debugMode, setDebugMode] = useState(false);
  const { landmarks, fps, handedness } = useHandTracking(video);
  const { letter, confidence, isModelReady, debugInfo } = useSignClassifier(landmarks, handedness, debugMode);

  const { prompt, advance } = useLessonEngine();
  const [targetLetter, setTargetLetter] = useState(prompt.letter);
  const [progressSnapshot, setProgressSnapshot] = useState(() => ProgressService.getProgress());
  const unlockedTier = useMemo(() => LessonEngine.getUnlockedTier(progressSnapshot), [progressSnapshot]);

  const { analysis, structuredFeedback, message, isPhrasingLoading, isLLMAvailable } = usePoseFeedback(
    landmarks,
    handedness,
    targetLetter,
    accuracyThreshold
  );

  useProgressTracking(targetLetter, analysis, (_completedLetter, _wasSuccess) => {
    // Round just closed (held-correct or abandoned) — ask the engine what's
    // next and follow it, unless the learner manually picks something else
    // in the meantime (setTargetLetter below always wins, since it's the
    // last write before the next round starts). Also refresh the Sidebar's
    // snapshot so tier-unlock state and per-letter accuracy stay current.
    advance();
    setProgressSnapshot(ProgressService.getProgress());
  });

  // Follow the engine's suggestion whenever it changes (i.e. right after
  // advance() above causes useLessonEngine to recompute). A manual pick via
  // LetterPicker still calls setTargetLetter directly and takes over from
  // there — this effect only fires on a genuine new suggestion.
  useEffect(() => {
    setTargetLetter(prompt.letter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt.letter]);

  const activeLesson: Lesson = {
    id: targetLetter,
    title: prompt.type === "word" && prompt.word ? `Spell "${prompt.word}"` : `Letter ${targetLetter}`,
    description:
      prompt.type === "word" && prompt.word
        ? `Sign each letter of "${prompt.word}" in order, holding "${targetLetter}" first. ${prompt.reason}`
        : `Hold the ASL sign for "${targetLetter}" in view of the camera. ${prompt.reason}`,
    signName: targetLetter,
    difficulty: prompt.tier === "foundational" ? "beginner" : prompt.tier === "intermediate" ? "intermediate" : "advanced",
    completed: false,
  };

  const detectionCaption = letter
    ? `Classifier detects: ${letter} (${Math.round((confidence ?? 0) * 100)}%)`
    : isModelReady
      ? "Classifier: no confident match yet."
      : "Loading sign classifier...";

  return (
    <div className={styles.body}>
      <Sidebar
        activeLetter={targetLetter}
        progress={progressSnapshot}
        unlockedTier={unlockedTier}
        onSelectLetter={setTargetLetter}
      />

      <main className={styles.main}>
        <div className={classNames(styles.stage, "bracket-frame")} data-active="true">
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

        <button
          type="button"
          className={styles.debugToggle}
          onClick={() => setDebugMode((v) => !v)}
          aria-pressed={debugMode}
        >
          {debugMode ? "Hide" : "Show"} classifier debug info
        </button>
        {debugMode && (
          <DebugPanel debugInfo={debugInfo} displayedLetter={letter} displayedConfidence={confidence} />
        )}
      </div>
    </div>
  );
}
