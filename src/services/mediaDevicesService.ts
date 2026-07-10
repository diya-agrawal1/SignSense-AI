import type { CameraConstraintsOptions, CameraError } from "../models/camera";

/**
 * Thin wrapper around the browser MediaDevices API.
 * Keeping this outside React means it can be unit-tested or swapped
 * (e.g. for a mock stream) without touching component code.
 */

export function isMediaDevicesSupported(): boolean {
  return Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

export function buildVideoConstraints(
  options: CameraConstraintsOptions = {}
): MediaStreamConstraints {
  const { facingMode = "user", width = 1280, height = 720 } = options;

  return {
    audio: false,
    video: {
      facingMode,
      width: { ideal: width },
      height: { ideal: height },
    },
  };
}

export async function requestCameraStream(
  options?: CameraConstraintsOptions
): Promise<MediaStream> {
  if (!isMediaDevicesSupported()) {
    const error: CameraError = {
      code: "UNSUPPORTED_BROWSER",
      message: "This browser does not support camera access (getUserMedia unavailable).",
    };
    throw error;
  }

  try {
    const constraints = buildVideoConstraints(options);
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (err) {
    throw mapMediaError(err);
  }
}

export function stopCameraStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}

function mapMediaError(err: unknown): CameraError {
  const name = err instanceof DOMException ? err.name : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return {
        code: "PERMISSION_DENIED",
        message: "Camera access was denied. Please allow camera permission to continue.",
      };
    case "NotFoundError":
    case "DevicesNotFoundError":
      return {
        code: "NO_DEVICE_FOUND",
        message: "No camera device was found on this system.",
      };
    case "NotReadableError":
    case "TrackStartError":
      return {
        code: "DEVICE_IN_USE",
        message: "The camera is already in use by another application.",
      };
    default:
      return {
        code: "UNKNOWN",
        message: "An unexpected error occurred while accessing the camera.",
      };
  }
}
