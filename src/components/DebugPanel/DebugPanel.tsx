import { useState } from "react";
import type { SignClassifierDebugInfo } from "../../hooks/useSignClassifier";
import { classNames } from "../../utils/classNames";
import styles from "./DebugPanel.module.css";

export interface DebugPanelProps {
  debugInfo: SignClassifierDebugInfo | null;
  /** The letter/confidence actually surfaced to the user (i.e. after the confidence threshold is applied). */
  displayedLetter: string | null;
  displayedConfidence: number | null;
}

const TOP_N = 5;

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Diagnostic overlay for the classifier pipeline (Stage: debugging tools).
 * Surfaces exactly what LandmarkProcessor + SignClassifierService produced
 * for the most recent frame, so a discrepancy between "what the user
 * signed" and "what the model predicted" can be tracked down to a specific
 * pipeline stage rather than guessed at:
 *
 * - Predicted letter / confidence (raw, before the display threshold)
 * - Top-5 class probabilities, so near-miss confusions are visible
 *   (e.g. "A" narrowly losing to "S" tells a very different story than
 *   "A" losing to "C")
 * - The handedness value actually used for canonicalization this frame
 * - The raw 63-value normalized feature vector, for spotting NaNs,
 *   blown-up scale, or a suspiciously-zeroed axis at a glance
 */
export function DebugPanel({ debugInfo, displayedLetter, displayedConfidence }: DebugPanelProps) {
  const [showVector, setShowVector] = useState(false);

  if (!debugInfo) {
    return (
      <section className={styles.panel} aria-live="polite">
        <h3 className={styles.title}>Debug</h3>
        <p className={styles.empty}>No hand detected yet — hold a sign in view of the camera.</p>
      </section>
    );
  }

  const top = debugInfo.ranked.slice(0, TOP_N);
  const maxConfidence = top[0]?.confidence ?? 1;

  return (
    <section className={styles.panel} aria-live="polite">
      <h3 className={styles.title}>Debug</h3>

      <dl className={styles.summary}>
        <div className={styles.summaryRow}>
          <dt>Displayed</dt>
          <dd>
            {displayedLetter ? `${displayedLetter} (${formatPercent(displayedConfidence ?? 0)})` : "— below threshold"}
          </dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Raw top-1</dt>
          <dd>
            {debugInfo.rawTopLetter} ({formatPercent(debugInfo.rawTopConfidence)})
          </dd>
        </div>
        <div className={styles.summaryRow}>
          <dt>Handedness</dt>
          <dd>{debugInfo.handedness ?? "unknown"}</dd>
        </div>
      </dl>

      <ol className={styles.rankedList}>
        {top.map((prediction, i) => (
          <li key={prediction.letter} className={styles.rankedRow}>
            <span className={styles.rank}>{i + 1}</span>
            <span className={styles.letter}>{prediction.letter}</span>
            <span className={styles.barTrack}>
              <span
                className={styles.barFill}
                style={{ width: `${(prediction.confidence / maxConfidence) * 100}%` }}
              />
            </span>
            <span className={styles.confidence}>{formatPercent(prediction.confidence)}</span>
          </li>
        ))}
      </ol>

      <button
        type="button"
        className={styles.toggleButton}
        onClick={() => setShowVector((v) => !v)}
        aria-expanded={showVector}
      >
        {showVector ? "Hide" : "Show"} raw feature vector (63 values)
      </button>

      {showVector && (
        <pre className={classNames(styles.vector)}>
          {debugInfo.features.map((v) => v.toFixed(4)).join(", ")}
        </pre>
      )}
    </section>
  );
}
