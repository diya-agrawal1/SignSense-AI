import { classNames } from "../../utils/classNames";
import styles from "./Header.module.css";

export type AppView = "tutor" | "dashboard";

export interface HeaderProps {
  title?: string;
  /** Which top-level screen is active. Omit to hide the nav (e.g. for a future embedded/kiosk mode). */
  activeView?: AppView;
  /** Called when the user picks a different screen from the nav. */
  onNavigate?: (view: AppView) => void;
}

const NAV_ITEMS: Array<{ view: AppView; label: string }> = [
  { view: "tutor", label: "Practice" },
  { view: "dashboard", label: "Dashboard" },
];

/**
 * Top-level app header. Rendered once in App.tsx (not per-page) so the nav
 * and offline badge stay put while the active screen swaps underneath.
 */
export function Header({ title = "SignSense AI", activeView, onNavigate }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          <svg className={styles.markIcon} viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
            <g fill="currentColor">
              <rect x="10.9" y="15.7" width="10.2" height="9.3" rx="3.5" />
              <rect x="15" y="14.4" width="4.2" height="2.2" rx="1.1" />
              <rect x="12.2" y="2.9" width="3.2" height="12.5" rx="1.6" transform="rotate(-10 13.8 9.1)" />
              <rect x="20.5" y="5.4" width="2.2" height="9.6" rx="1.1" transform="rotate(16 21.6 10.2)" />
              <rect x="2.9" y="17.3" width="8" height="2.9" rx="1.4" transform="rotate(-20 6.9 18.7)" />
            </g>
          </svg>
          <span className={styles.markPulse} />
        </span>
        <h1 className={styles.title}>{title}</h1>
      </div>

      {activeView && onNavigate && (
        <nav className={styles.nav} aria-label="Main">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.view}
              type="button"
              className={classNames(styles.navItem, item.view === activeView && styles.navItemActive)}
              aria-current={item.view === activeView ? "page" : undefined}
              onClick={() => onNavigate(item.view)}
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}

      <span className={styles.status}>OFFLINE MODE</span>
    </header>
  );
}
