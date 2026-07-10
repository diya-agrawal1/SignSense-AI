import { useCallback, useEffect, useRef, useState } from "react";
import type { CameraConstraintsOptions, CameraError, CameraStatus } from "../models/camera";
import {
  isMediaDevicesSupported,
  requestCameraStream,
  stopCameraStream,
} from "../services/mediaDevicesService";

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: CameraError | null;
  start: () => Promise<void>;
  stop: () => void;
  retry: () => Promise<void>;
}

/**
 * Encapsulates the full lifecycle of requesting, attaching, and tearing
 * down a webcam stream. UI components stay declarative and only read
 * `status` / `error` to decide what to render.
 */
export function useCamera(options?: CameraConstraintsOptions): UseCameraResult {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraError | null>(null);

  const stop = useCallback(() => {
    stopCameraStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  const start = useCallback(async () => {
    if (!isMediaDevicesSupported()) {
      setStatus("unsupported");
      setError({
        code: "UNSUPPORTED_BROWSER",
        message: "This browser does not support camera access.",
      });
      return;
    }

    setStatus("requesting");
    setError(null);

    try {
      const stream = await requestCameraStream(options);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setStatus("streaming");
    } catch (err) {
      setStatus("error");
      setError(err as CameraError);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.facingMode, options?.width, options?.height]);

  const retry = useCallback(async () => {
    stop();
    await start();
  }, [start, stop]);

  // Ensure the stream is released when the component unmounts.
  useEffect(() => {
    return () => {
      stopCameraStream(streamRef.current);
    };
  }, []);

  return { videoRef, status, error, start, stop, retry };
}
