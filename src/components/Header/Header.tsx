import styles from "./Header.module.css";

export interface HeaderProps {
  title?: string;
}

/**
 * Top-level app header. Structural placeholder — content will grow
 * once navigation and user state are wired up.
 */
export function Header({ title = "SignSense AI" }: HeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <h1 className={styles.title}>{title}</h1>
      </div>
      <span className={styles.status}>OFFLINE MODE</span>
    </header>
  );
}
