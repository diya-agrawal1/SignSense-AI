import { useEffect, useState } from "react";
import { ProgressService } from "../../services/ProgressService";
import type { LetterAccuracy, PracticeEvent } from "../../models/progress";
import styles from "./DashboardPage.module.css";

interface DashboardData {
  accuracy: number | null;
  streak: { current: number; longest: number };
  totalPracticeTimeMs: number;
  weakest: LetterAccuracy[];
  strongest: LetterAccuracy[];
  history: PracticeEvent[];
}

function loadDashboardData(): DashboardData {
  return {
    accuracy: ProgressService.getOverallAccuracy(),
    streak: ProgressService.getStreak(),
    totalPracticeTimeMs: ProgressService.getTotalPracticeTimeMs(),
    weakest: ProgressService.getWeakLetters(5),
    strongest: ProgressService.getStrongLetters(5),
    history: ProgressService.getRecentHistory(10),
  };
}

function formatPracticeTime(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Simple CSS bar — deliberately not pulling in a charting library for a handful of horizontal bars. */
function AccuracyBar({ label, successRate, attempts }: { label: string; successRate: number; attempts: number }) {
  return (
    <li className={styles.barRow}>
      <span className={styles.barLabel}>{label}</span>
      <div className={styles.barTrack}>
        <div className={styles.barFill} style={{ width: `${Math.round(successRate * 100)}%` }} />
      </div>
      <span className={styles.barValue}>
        {Math.round(successRate * 100)}% ({attempts})
      </span>
    </li>
  );
}

/**
 * Dashboard screen (Stage 9 data + Stage 11 view, built together). Reads
 * everything from ProgressService/LocalStorage on mount — no live
 * subscription, since the only way to reach this screen is by navigating
 * here via the Header, which naturally remounts it with fresh data each time.
 */
export function DashboardPage() {
  const [data, setData] = useState<DashboardData>(loadDashboardData);

  useEffect(() => {
    setData(loadDashboardData());
  }, []);

  const handleReset = () => {
    const confirmed = window.confirm("Clear all locally stored practice progress? This can't be undone.");
    if (!confirmed) return;
    ProgressService.reset();
    setData(loadDashboardData());
  };

  const hasAnyData = data.accuracy !== null;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <div>
          <h2 className={styles.title}>Your Progress</h2>
          <p className={styles.subtitle}>Everything here is stored only on this device.</p>
        </div>
        {hasAnyData && (
          <button type="button" className={styles.resetButton} onClick={handleReset}>
            Reset progress
          </button>
        )}
      </div>

      {!hasAnyData ? (
        <div className={styles.empty}>
          <p>No practice recorded yet — head to Practice and try a few letters.</p>
        </div>
      ) : (
        <>
          <div className={styles.statGrid}>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Overall accuracy</span>
              <span className={styles.statValue}>{Math.round((data.accuracy ?? 0) * 100)}%</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Current streak</span>
              <span className={styles.statValue}>
                {data.streak.current} {data.streak.current === 1 ? "day" : "days"}
              </span>
              <span className={styles.statHint}>Longest: {data.streak.longest}</span>
            </div>
            <div className={styles.statCard}>
              <span className={styles.statLabel}>Practice time</span>
              <span className={styles.statValue}>{formatPracticeTime(data.totalPracticeTimeMs)}</span>
            </div>
          </div>

          <div className={styles.columns}>
            <section className={styles.panel}>
              <h3 className={styles.panelTitle}>Letters to work on</h3>
              {data.weakest.length === 0 ? (
                <p className={styles.panelEmpty}>Not enough attempts yet.</p>
              ) : (
                <ul className={styles.barList}>
                  {data.weakest.map((entry) => (
                    <AccuracyBar key={entry.letter} label={entry.letter} successRate={entry.successRate} attempts={entry.attempts} />
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.panel}>
              <h3 className={styles.panelTitle}>Strongest letters</h3>
              {data.strongest.length === 0 ? (
                <p className={styles.panelEmpty}>Not enough attempts yet.</p>
              ) : (
                <ul className={styles.barList}>
                  {data.strongest.map((entry) => (
                    <AccuracyBar key={entry.letter} label={entry.letter} successRate={entry.successRate} attempts={entry.attempts} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className={styles.panel}>
            <h3 className={styles.panelTitle}>Recent history</h3>
            <ul className={styles.historyList}>
              {data.history.map((event, i) => (
                <li key={`${event.timestamp}-${i}`} className={styles.historyRow}>
                  <span
                    className={styles.historyDot}
                    data-status={event.wasSuccess ? "success" : "miss"}
                    aria-hidden="true"
                  />
                  <span className={styles.historyLetter}>{event.letter}</span>
                  <span className={styles.historyStatus}>{event.wasSuccess ? "Got it" : "Didn't land"}</span>
                  <span className={styles.historyTime}>{formatRelativeTime(event.timestamp)}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
