import { useState } from "react";
import { Header } from "./components/Header";
import type { AppView } from "./components/Header";
import { TutorPage } from "./pages/TutorPage";
import { DashboardPage } from "./pages/DashboardPage";
import styles from "./App.module.css";

/**
 * Root shell. Header is rendered once here (not per-page) so navigation and
 * the offline badge stay put while the active screen swaps underneath.
 *
 * Deliberately plain useState view-switching rather than a router — the app
 * only has two screens and stays fully offline/dependency-light; add
 * react-router if a third screen or deep-linking need ever shows up.
 */
function App() {
  const [view, setView] = useState<AppView>("tutor");

  return (
    <div className={styles.shell}>
      <Header activeView={view} onNavigate={setView} />
      <div className={styles.content}>{view === "tutor" ? <TutorPage /> : <DashboardPage />}</div>
    </div>
  );
}

export default App;
