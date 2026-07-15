import { useEffect, useRef, useState } from "react";
import { SignClassifierService } from "../services/SignClassifierService";
import type { ClassificationResult, DetailedClassificationResult, RankedPrediction } from "../services/SignClassifierService";
import { LandmarkProcessor } from "../services/LandmarkProcessor";
import type { FeatureVector } from "../models/landmarkProcessing";
import type { HandLandmarks, Handedness } from "../models/handTracking";

export interface SignClassifierDebugInfo {
  /** Every letter the model considered, sorted by confidence descending. */
  ranked: RankedPrediction[];
  /** The exact 63-value vector fed into the model this run, post wrist-centering/scale/mirroring. */
  features: FeatureVector;
  /** Handedness used for this run's canonicalization (post handedness-inversion fix in HandTrackingService). */
  handedness: Handedness | null;
  /** Top prediction before the confidence threshold is applied (may differ from `letter` below it). */
  rawTopLetter: string;
  rawTopConfidence: number;
}

interface UseSignClassifierResult {
  letter: string | null;
  confidence: number | null;
  /** True once the model + labels have finished loading and predictions can run. */
  isModelReady: boolean;
  /** Only populated when `debug` is true. Top-5 predictions, raw feature vector, etc. */
  debugInfo: SignClassifierDebugInfo | null;
}

/**
 * Below this confidence, we treat the prediction as "not sure enough to
 * show" rather than displaying a low-confidence guess that would just
 * confuse a learner mid-lesson.
 */
const CONFIDENCE_THRESHOLD = 0.6;

/**
 * Throttle inference rather than running a forward pass on every single
 * tracked frame (~30/sec) — a sign is held for a while, so 5 predictions/sec
 * is plenty responsive and much cheaper.
 */
const PREDICTION_INTERVAL_MS = 200;

function isDetailedResult(
  result: ClassificationResult | DetailedClassificationResult
): result is DetailedClassificationResult {
  return Array.isArray((result as DetailedClassificationResult).ranked);
}

/**
 * useSignClassifier
 *
 * Owns a SignClassifierService instance and turns live hand landmarks
 * into a predicted letter, running LandmarkProcessor + the TF.js model
 * on a throttled interval whenever new landmarks arrive.
 */
export function useSignClassifier(
  landmarks: HandLandmarks | null,
  handedness: Handedness | null,
  debug = false
): UseSignClassifierResult {
  const serviceRef = useRef<SignClassifierService | null>(null);
  const lastRunRef = useRef(0);
  const [letter, setLetter] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [debugInfo, setDebugInfo] = useState<SignClassifierDebugInfo | null>(null);

  useEffect(() => {
    const service = new SignClassifierService();
    serviceRef.current = service;
    setIsModelReady(false);

    service
      .warmUp()
      .then(() => setIsModelReady(true))
      .catch((err: unknown) => {
        console.error("[useSignClassifier] failed to load model:", err);
      });

    return () => {
      serviceRef.current = null;
      void service.dispose();
    };
  }, []);

  useEffect(() => {
    if (!landmarks || !isModelReady || !serviceRef.current) return;

    const now = performance.now();
    if (now - lastRunRef.current < PREDICTION_INTERVAL_MS) return;
    lastRunRef.current = now;

    const features = LandmarkProcessor.process(landmarks, handedness);
    const service = serviceRef.current;

    const predictionPromise: Promise<ClassificationResult | DetailedClassificationResult> = debug
      ? service.predictDetailed(features)
      : service.predict(features);

    predictionPromise
      .then((result) => {
        if (result.confidence >= CONFIDENCE_THRESHOLD) {
          setLetter(result.letter);
          setConfidence(result.confidence);
        } else {
          setLetter(null);
          setConfidence(null);
        }

        if (debug && isDetailedResult(result)) {
          setDebugInfo({
            ranked: result.ranked,
            features,
            handedness,
            rawTopLetter: result.letter,
            rawTopConfidence: result.confidence,
          });
        } else if (!debug) {
          setDebugInfo(null);
        }
      })
      .catch((err: unknown) => {
        console.error("[useSignClassifier] prediction failed:", err);
      });
  }, [landmarks, handedness, isModelReady, debug]);

  return { letter, confidence, isModelReady, debugInfo };
}
