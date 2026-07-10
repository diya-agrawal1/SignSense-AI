import { useEffect } from "react";
import { useCamera } from "../../hooks/useCamera";
import type { CameraConstraintsOptions } from "../../models/camera";
import styles from "./Camera.module.css";

export interface CameraProps {
  /** Start requesting the camera as soon as the component mounts. Default: true. */
  autoStart?: boolean;
  /** Optional constraints (facingMode, width, height) forwarded to getUserMedia. */
  constraints?: CameraConstraintsOptions;
  /** Called once a stream is successfully attached to the video element. */
  onReady?: (video: HTMLVideoElement) => void;
  /** Optional class applied to the outer frame, for layout by the parent. */
  className?: string;
}

/**
 * Renders a live webcam feed with built-in permission, loading and
 * error handling. Pure video capture only — no pose/skeleton detection
 * is performed here.
 */
export function Camera({ autoStart = true, constraints, onReady, className }: CameraProps) {
  const { videoRef, status, error, start, retry } = useCamera(constraints);

  useEffect(() => {
    if (autoStart) {
      start();
    }
    // Only run on mount / when autoStart flips true->true is a no-op we want.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    if (status === "streaming" && videoRef.current && onReady) {
      onReady(videoRef.current);
    }
  }, [status, videoRef, onReady]);

  const frameClassName = className ? `${styles.frame} ${className}` : styles.frame;

  return (
    <div className={frameClassName} role="group" aria-label="Camera preview">
      <video
        ref={videoRef}
        className={styles.video}
        data-visible={status === "streaming"}
        autoPlay
        playsInline
        muted
        aria-hidden={status !== "streaming"}
      />

      {status === "streaming" && (
        <div className={styles.statusBadge}>
          <span className={styles.liveDot} aria-hidden="true" />
          LIVE
        </div>
      )}

      {status === "idle" && (
        <div className={styles.overlayCenter}>
          <p className={styles.title}>Camera is off</p>
          <p className={styles.subtitle}>Start the camera to begin practicing signs.</p>
          <button type="button" className={styles.startButton} onClick={() => start()}>
            Turn on camera
          </button>
        </div>
      )}

      {status === "requesting" && (
        <div className={styles.overlayCenter} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <p className={styles.title}>Requesting camera access…</p>
          <p className={styles.subtitle}>Please allow the permission prompt from your browser.</p>
        </div>
      )}

      {status === "unsupported" && (
        <div className={styles.overlayCenter} role="alert">
          <p className={styles.title}>Camera not supported</p>
          <p className={styles.subtitle}>
            Your browser doesn't support webcam access. Try the latest Chrome, Edge, or Firefox.
          </p>
        </div>
      )}

      {status === "error" && (
        <div className={styles.overlayCenter} role="alert">
          <p className={styles.title}>Couldn't access your camera</p>
          <p className={styles.subtitle}>
            {error?.message ?? "Something went wrong while accessing the camera."}
          </p>
          <button type="button" className={styles.retryButton} onClick={() => retry()}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
