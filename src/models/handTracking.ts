/**
 * Domain types for hand landmark detection.
 * Kept separate from the MediaPipe-specific service so this file has no
 * dependency on any particular detection library — matches the pattern
 * used in models/camera.ts.
 */

export interface NormalizedLandmark {
  x: number; // 0..1, normalized to frame width
  y: number; // 0..1, normalized to frame height
  z: number; // relative depth, roughly wrist-origin scale
}

/** Always 21 entries when a hand is detected, matching MediaPipe's hand landmark topology. */
export type HandLandmarks = NormalizedLandmark[];

export type Handedness = "Left" | "Right";

export interface HandTrackingResult {
  landmarks: HandLandmarks | null;
  handedness: Handedness | null;
  score: number | null;
  timestamp: number; // performance.now() at detection time
}

export interface HandTrackingOptions {
  maxNumHands: number;
  modelComplexity: 0 | 1;
  minDetectionConfidence: number;
  minTrackingConfidence: number;
}

export type HandTrackingListener = (result: HandTrackingResult) => void;

/** Index pairs describing which landmarks are connected, e.g. [0, 1] = wrist -> thumb_cmc. */
export type HandConnection = readonly [number, number];

/**
 * Fixed hand-skeleton topology (wrist + 4 joints per finger). This mirrors
 * MediaPipe's own HAND_CONNECTIONS constant, duplicated here as static data
 * so drawing code doesn't need the MediaPipe runtime loaded just to know
 * which landmarks connect to which — it's model topology, not live output.
 */
export const HAND_CONNECTIONS: HandConnection[] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [0, 17], [17, 18], [18, 19], [19, 20],
];
