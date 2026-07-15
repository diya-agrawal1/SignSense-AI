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
        <span className={styles.mark} aria-hidden="true" />
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
