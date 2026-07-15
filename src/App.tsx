import { useState } from "react";
import { HomePage } from "./pages/HomePage";
import { TutorPage } from "./pages/TutorPage";

type AppView = "home" | "practice";

/**
 * Top-level screen switch. Deliberately plain useState rather than a
 * router: the app has exactly two screens and no deep-linkable URLs, so a
 * router dependency would add weight without adding capability. Mounting
 * TutorPage only once "practice" is entered is also what makes "Camera
 * opens" a real step in the flow rather than something that happens
 * silently on page load.
 */
function App() {
  const [view, setView] = useState<AppView>("home");

  if (view === "practice") {
    return <TutorPage onExit={() => setView("home")} />;
  }

  return <HomePage onStartPractice={() => setView("practice")} />;
}

export default App;
