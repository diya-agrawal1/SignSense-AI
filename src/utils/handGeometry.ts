import type { HandLandmarks, NormalizedLandmark } from "../models/handTracking";

/** Euclidean distance between two landmarks (3D). */
export function distance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Angle at vertex `b`, formed by the rays b->a and b->c, in degrees.
 * 180 degrees means a-b-c are collinear (finger fully straight through b);
 * small angles mean a sharp bend at b (finger fully curled at that joint).
 */
export function angleBetween(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  const v2 = { x: c.x - b.x, y: c.y - b.y, z: c.z - b.z };

  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = Math.sqrt(v1.x ** 2 + v1.y ** 2 + v1.z ** 2);
  const mag2 = Math.sqrt(v2.x ** 2 + v2.y ** 2 + v2.z ** 2);

  if (mag1 < 1e-9 || mag2 < 1e-9) return 180; // degenerate — treat as straight rather than NaN
  const cos = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * Mirrors landmarks along x. Same rationale as LandmarkProcessor's version:
 * a left hand is (for almost all signs) a mirror image of the right hand,
 * so canonicalizing lets one reference table cover both hands.
 */
export function mirrorHorizontally(landmarks: HandLandmarks): HandLandmarks {
  return landmarks.map((point) => ({ x: -point.x, y: point.y, z: point.z }));
}

/** Cross product of two 3D vectors. */
export function cross(
  v1: { x: number; y: number; z: number },
  v2: { x: number; y: number; z: number }
): { x: number; y: number; z: number } {
  return {
    x: v1.y * v2.z - v1.z * v2.y,
    y: v1.z * v2.x - v1.x * v2.z,
    z: v1.x * v2.y - v1.y * v2.x,
  };
}

/** Linear interpolation between two numbers. t=0 -> a, t=1 -> b. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Linear interpolation between two landmarks, component-wise. */
export function lerpLandmark(a: NormalizedLandmark, b: NormalizedLandmark, t: number): NormalizedLandmark {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/**
 * Signed angle (degrees) of a 2D vector from "straight up" on screen, in
 * MediaPipe's image-normalized coordinates (x right, y down).
 *
 * Positive = the vector is tilted clockwise from vertical; negative =
 * counterclockwise. Only x/y are used (z, depth, doesn't factor into an
 * on-screen roll reading) — this deliberately ignores forward/backward tilt,
 * which palm-orientation (facingCamera/facingAway) already covers.
 */
export function signedAngleFromVertical(v: { x: number; y: number }): number {
  return (Math.atan2(v.x, -v.y) * 180) / Math.PI;
}
