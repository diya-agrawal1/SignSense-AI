import { useEffect, useRef, useState, useCallback } from "react";
import { HandTrackingService } from "../services/HandTrackingService";
import type { HandTrackingResult, HandTrackingOptions } from "../models/handTracking";

interface UseHandTrackingResult {
  landmarks: HandTrackingResult["landmarks"];
  handedness: HandTrackingResult["handedness"];
  fps: number;
  /** True while a hand is currently detected in frame. */
  isTracking: boolean;
}

const FPS_SAMPLE_WINDOW = 30;

/**
 * useHandTracking
 *
 * Owns the lifecycle of a HandTrackingService instance tied to a video
 * element, and exposes the latest detection result as React state.
 *
 * Takes the video element directly (not a ref object) so it composes
 * naturally with Camera's `onReady(video)` callback: keep the element
 * in state in the parent and pass it straight through.
 *
 * Note: `options` is read once on mount via a ref — reinitializing the
 * MediaPipe model on every render would be expensive. Pass a stable
 * object (defined outside the component, or via useMemo) if needed.
 */
export function useHandTracking(
  videoElement: HTMLVideoElement | null,
  options?: Partial<HandTrackingOptions>
): UseHandTrackingResult {
  const optionsRef = useRef(options);
  const timestampsRef = useRef<number[]>([]);

  const [landmarks, setLandmarks] = useState<HandTrackingResult["landmarks"]>(null);
  const [handedness, setHandedness] = useState<HandTrackingResult["handedness"]>(null);
  const [fps, setFps] = useState(0);
  const [isTracking, setIsTracking] = useState(false);

  const handleResult = useCallback((result: HandTrackingResult) => {
    setLandmarks(result.landmarks);
    setHandedness(result.handedness);
    setIsTracking(result.landmarks !== null);

    const stamps = timestampsRef.current;
    stamps.push(result.timestamp);
    if (stamps.length > FPS_SAMPLE_WINDOW) stamps.shift();

    if (stamps.length >= 2) {
      const elapsedMs = stamps[stamps.length - 1] - stamps[0];
      if (elapsedMs > 0) {
        setFps(Math.round(((stamps.length - 1) / elapsedMs) * 1000));
      }
    }
  }, []);

  useEffect(() => {
    if (!videoElement) return;

    const service = new HandTrackingService(optionsRef.current);
    const unsubscribe = service.subscribe(handleResult);

    const beginTracking = () => service.start(videoElement);

    if (videoElement.readyState >= 2) {
      beginTracking();
    } else {
      videoElement.addEventListener("loadeddata", beginTracking, { once: true });
    }

    return () => {
      videoElement.removeEventListener("loadeddata", beginTracking);
      unsubscribe();
      service.destroy();
      timestampsRef.current = [];
      setLandmarks(null);
      setIsTracking(false);
    };
  }, [videoElement, handleResult]);

  return { landmarks, handedness, fps, isTracking };
}
