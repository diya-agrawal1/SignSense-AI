import { useEffect, useMemo, useRef, useState } from "react";
import { PoseAnalysisService } from "../services/PoseAnalysisService";
import { LLMFeedbackService } from "../services/LLMFeedbackService";
import { generateStructuredFeedback, generateTemplateFeedback } from "../utils/templateFeedback";
import type { HandLandmarks, Handedness } from "../models/handTracking";
import type { PoseAnalysisResult } from "../models/poseAnalysis";

export type FeedbackSource = "template" | "llm";

interface UsePoseFeedbackResult {
  /** Part A's structured result — always available synchronously once a hand is tracked. Drives skeleton highlighting. */
  analysis: PoseAnalysisResult | null;
  /** One line per finger/palm/wrist check, e.g. "Thumb correct", "Rotate wrist slightly clockwise". */
  structuredFeedback: string[];
  /** Phrased feedback sentence — template instantly, upgraded to LLM phrasing when it resolves. */
  message: string | null;
  /** Which layer produced `message` right now. */
  source: FeedbackSource;
  /** Whether the on-device LLM is currently generating a phrased message. */
  isPhrasingLoading: boolean;
  /** Whether the LLM is usable at all in this browser/session (false = template-only for the whole session). */
  isLLMAvailable: boolean;
}

/** How long a given finger/palm "fingerprint" must stay unchanged before we bother asking the LLM to phrase it — keeps calls to roughly once per held attempt, not once per frame. */
const STABILITY_MS = 600;

function fingerprint(result: PoseAnalysisResult): string {
  const fingerPart = Object.entries(result.fingers)
    .map(([name, f]) => `${name}:${f.status}:${f.issue ?? ""}`)
    .join(",");
  return `${result.letter}|${fingerPart}|${result.palm.status}:${result.palm.issue ?? ""}`;
}

/**
 * usePoseFeedback
 *
 * Owns a PoseAnalysisService (Part A, sync) + LLMFeedbackService (Part B,
 * async) pair for a given target letter, and exposes the combined tutor
 * feedback described in Stage 6: raw findings available immediately for
 * UI/skeleton highlighting, phrased message streamed in when ready or
 * template-based when the LLM isn't available.
 */
export function usePoseFeedback(
  landmarks: HandLandmarks | null,
  handedness: Handedness | null,
  targetLetter: string | null,
  accuracyThreshold?: number
): UsePoseFeedbackResult {
  const llmServiceRef = useRef<LLMFeedbackService | null>(null);
  const stabilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFingerprintRef = useRef<string | null>(null);

  const [message, setMessage] = useState<string | null>(null);
  const [source, setSource] = useState<FeedbackSource>("template");
  const [isPhrasingLoading, setIsPhrasingLoading] = useState(false);
  const [isLLMAvailable, setIsLLMAvailable] = useState(() => LLMFeedbackService.isSupported());

  useEffect(() => {
    if (!isLLMAvailable) return;
    const service = new LLMFeedbackService();
    llmServiceRef.current = service;
    // Lazy-load in the background as soon as tutor mode starts, so the
    // first real attempt doesn't pay the full model-download latency.
    service.preload().catch(() => {
      setIsLLMAvailable(false);
    });

    return () => {
      llmServiceRef.current = null;
      void service.dispose();
    };
  }, [isLLMAvailable]);

  const analysis = useMemo<PoseAnalysisResult | null>(() => {
    if (!landmarks || !targetLetter) return null;
    try {
      return PoseAnalysisService.analyze(landmarks, handedness, targetLetter, accuracyThreshold);
    } catch (err) {
      console.error("[usePoseFeedback] pose analysis failed:", err);
      return null;
    }
  }, [landmarks, handedness, targetLetter, accuracyThreshold]);

  useEffect(() => {
    if (!analysis) {
      setMessage(null);
      return;
    }

    // Always show template phrasing immediately — instant and reliable.
    setMessage(generateTemplateFeedback(analysis));
    setSource("template");

    if (!isLLMAvailable) return;

    const fp = fingerprint(analysis);
    if (fp === lastFingerprintRef.current) return; // nothing meaningful changed since last stable check

    if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);

    stabilityTimerRef.current = setTimeout(() => {
      lastFingerprintRef.current = fp;
      const service = llmServiceRef.current;
      if (!service) return;

      setIsPhrasingLoading(true);
      service
        .generateFeedback(analysis)
        .then((text) => {
          setMessage(text);
          setSource("llm");
        })
        .catch((err: unknown) => {
          console.error("[usePoseFeedback] LLM phrasing failed, staying on template:", err);
        })
        .finally(() => setIsPhrasingLoading(false));
    }, STABILITY_MS);

    return () => {
      if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
    };
  }, [analysis, isLLMAvailable]);

  const structuredFeedback = useMemo(() => (analysis ? generateStructuredFeedback(analysis) : []), [analysis]);

  return { analysis, structuredFeedback, message, source, isPhrasingLoading, isLLMAvailable };
}
