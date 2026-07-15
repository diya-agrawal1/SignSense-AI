import { useMemo } from "react";
import { Header } from "../../components/Header";
import { ProgressService } from "../../services/ProgressService";
import { LessonEngine } from "../../services/LessonEngine";
import styles from "./HomePage.module.css";

export interface HomePageProps {
  /** Navigate to the practice/tutor screen. */
  onStartPractice: () => void;
}

/** Small presentational tile for a single headline stat. Local to Home, same pattern as TutorPage's local LetterPicker. */
function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statValue}>{value}</p>
      <p className={styles.statLabel}>{label}</p>
      {hint && <p className={styles.statHint}>{hint}</p>}
    </div>
  );
}

/**
 * Landing screen. Shows what the app does, a single "Start Practice" call
 * to action, and — once there's saved history — a snapshot of the
 * learner's progress pulled straight from ProgressService/LessonEngine, so
 * Home stays a genuine dashboard rather than a static splash screen.
 *
 * Reads progress once per mount: Home is unmounted while Practice is
 * active (see App.tsx's view switch) and remounts fresh on return, so a
 * plain read here always reflects whatever was just saved — no live
 * subscription needed.
 */
export function HomePage({ onStartPractice }: HomePageProps) {
  const summary = useMemo(() => ProgressService.getSummary(), []);
  const tiers = useMemo(() => LessonEngine.getTierProgress(), []);
  const hasHistory = summary.totalAttempts > 0;

  return (
    <div className={styles.layout}>
      <Header />

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Offline ASL fingerspelling tutor</p>
          <h2 className={styles.heading}>Practice signs with live, on-device feedback</h2>
          <p className={styles.subheading}>
            Your camera feed never leaves this device. MediaPipe tracks your hand, a local
            classifier reads the letter you're signing, and pose analysis tells you exactly
            which finger to adjust — all running fully offline.
          </p>
          <button type="button" className={styles.cta} onClick={onStartPractice}>
            Start Practice
          </button>
        </section>

        <section className={styles.stats} aria-label="Your progress">
          <StatCard label="Attempts" value={String(summary.totalAttempts)} />
          <StatCard label="Accuracy" value={summary.accuracy != null ? `${summary.accuracy}%` : "—"} />
          <StatCard
            label="Day streak"
            value={String(summary.currentStreak)}
            hint={`Best ${summary.longestStreak}`}
          />
          <StatCard
            label="Avg. response"
            value={summary.averageResponseTimeMs != null ? `${(summary.averageResponseTimeMs / 1000).toFixed(1)}s` : "—"}
          />
        </section>

        <section className={styles.tiers} aria-label="Difficulty progress">
          <p className={styles.sectionTitle}>Difficulty tiers</p>
          <div className={styles.tierList}>
            {tiers.map((tier) => (
              <div key={tier.difficulty} className={styles.tierRow}>
                <span className={styles.tierName} data-unlocked={tier.unlocked}>
                  {tier.difficulty}
                </span>
                <div className={styles.tierBar}>
                  <div
                    className={styles.tierBarFill}
                    data-unlocked={tier.unlocked}
                    style={{ width: `${Math.min(100, (tier.attempts / tier.requiredAttempts) * 100)}%` }}
                  />
                </div>
                <span className={styles.tierMeta}>
                  {tier.unlocked
                    ? tier.accuracy != null
                      ? `Unlocked · ${tier.accuracy}% acc.`
                      : "Unlocked"
                    : `${tier.attempts}/${tier.requiredAttempts} attempts`}
                </span>
              </div>
            ))}
          </div>
        </section>

        {hasHistory && summary.weakLetters.length > 0 && (
          <section className={styles.weak} aria-label="Letters to review">
            <p className={styles.sectionTitle}>Needs practice</p>
            <div className={styles.weakList}>
              {summary.weakLetters.map((w) => (
                <span key={w.letter} className={styles.weakChip}>
                  {w.letter} · {w.accuracy}%
                </span>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
