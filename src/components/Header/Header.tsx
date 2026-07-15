import styles from "./Header.module.css";

export interface HeaderProps {
  title?: string;
  /** Session score, from useSessionStats. Omit to hide the score readout (e.g. on Home). */
  score?: number;
  /** Current consecutive-correct combo, from useSessionStats. Omit to hide the streak readout. */
  streak?: number;
  /** When provided, renders a back button that returns to the home screen. */
  onHome?: () => void;
}

/**
 * Top-level app header, shared by every screen. Score/streak/back-button
 * are all optional so the same component works unchanged on Home (plain
 * brand bar) and during Practice (adds live session stats + a way back).
 */
export function Header({ title = "SignSense AI", score, streak, onHome }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        {onHome && (
          <button type="button" className={styles.homeButton} onClick={onHome} aria-label="Back to home">
            ←
          </button>
        )}
        <span className={styles.mark} aria-hidden="true" />
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.metrics}>
        {typeof score === "number" && (
          <span className={styles.metric} aria-label={`Score ${score}`}>
            <span className={styles.metricLabel}>Score</span>
            {score}
          </span>
        )}
        {typeof streak === "number" && (
          <span className={styles.metric} aria-label={`Streak ${streak}`}>
            <span className={styles.metricLabel}>Streak</span>
            {streak > 0 ? `${streak} 🔥` : streak}
          </span>
        )}
        <span className={styles.status}>OFFLINE MODE</span>
      </div>
    </header>
  );
}
