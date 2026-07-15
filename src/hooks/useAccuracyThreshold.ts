import { useEffect, useState } from "react";

const STORAGE_KEY = "signsense.accuracyThreshold";
export const DEFAULT_ACCURACY_THRESHOLD = 80;
export const MIN_ACCURACY_THRESHOLD = 50;
export const MAX_ACCURACY_THRESHOLD = 99;

function readStoredThreshold(): number {
  if (typeof localStorage === "undefined") return DEFAULT_ACCURACY_THRESHOLD;
  const raw = localStorage.getItem(STORAGE_KEY);
  const parsed = raw === null ? NaN : Number(raw);
  if (Number.isNaN(parsed)) return DEFAULT_ACCURACY_THRESHOLD;
  return Math.min(MAX_ACCURACY_THRESHOLD, Math.max(MIN_ACCURACY_THRESHOLD, parsed));
}

/**
 * useAccuracyThreshold
 *
 * The user-adjustable "how close counts as correct" sensitivity dial fed
 * into PoseAnalysisService.analyze(). Persisted to LocalStorage so it
 * carries over between sessions — set it once, not every time you practice.
 */
export function useAccuracyThreshold(): [number, (value: number) => void] {
  const [threshold, setThresholdState] = useState<number>(readStoredThreshold);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(threshold));
    } catch (err) {
      console.error("[useAccuracyThreshold] failed to persist threshold:", err);
    }
  }, [threshold]);

  const setThreshold = (value: number) => {
    setThresholdState(Math.min(MAX_ACCURACY_THRESHOLD, Math.max(MIN_ACCURACY_THRESHOLD, Math.round(value))));
  };

  return [threshold, setThreshold];
}
