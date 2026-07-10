/**
 * Domain types for camera/video capture.
 * Kept separate from AI/detection models so this file has no dependency
 * on any future ML integration.
 */

export type CameraStatus = "idle" | "requesting" | "streaming" | "error" | "unsupported";

export type CameraErrorCode =
  | "PERMISSION_DENIED"
  | "NO_DEVICE_FOUND"
  | "DEVICE_IN_USE"
  | "UNSUPPORTED_BROWSER"
  | "UNKNOWN";

export interface CameraError {
  code: CameraErrorCode;
  message: string;
}

export interface CameraConstraintsOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}
