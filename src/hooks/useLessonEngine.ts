import { useCallback, useMemo, useState } from "react";
import { LessonEngine } from "../services/LessonEngine";
import { ProgressService } from "../services/ProgressService";
import type { LessonEngineOptions, PracticePrompt } from "../models/lessonEngine";

interface UseLessonEngineResult {
  prompt: PracticePrompt;
  /** Call after a round ends (success or abandoned) to advance to the next suggested prompt. */
  advance: () => void;
}

/**
 * useLessonEngine
 *
 * Reads current progress from ProgressService (LocalStorage-backed, no
 * backend) and asks LessonEngine for the next practice prompt. Recomputes
 * on demand via `advance()` rather than on every render — progress only
 * meaningfully changes once a round completes, not continuously like
 * landmarks/classification do.
 */
export function useLessonEngine(options: LessonEngineOptions = {}): UseLessonEngineResult {
  const [promptCount, setPromptCount] = useState(0);

  // Deliberately NOT memoized on `promptCount` alone — ProgressService
  // reads from LocalStorage fresh each time, so re-running this after
  // every `advance()` call picks up whatever the most recent round just
  // recorded, without needing progress state threaded through props.
  const prompt = useMemo(
    () => LessonEngine.getNextPrompt(ProgressService.getProgress(), promptCount, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [promptCount]
  );

  const advance = useCallback(() => setPromptCount((count) => count + 1), []);

  return { prompt, advance };
}
