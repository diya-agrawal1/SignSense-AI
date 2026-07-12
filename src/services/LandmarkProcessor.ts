import type { HandLandmarks, Handedness } from "../models/handTracking";
import type { FeatureVector, LandmarkProcessingOptions } from "../models/landmarkProcessing";
import { DEFAULT_LANDMARK_PROCESSING_OPTIONS } from "../models/landmarkProcessing";

/** Landmark index of the wrist — the root joint, used as the origin for centering. */
const WRIST_INDEX = 0;

/**
 * Landmark index of the middle-finger MCP joint (the knuckle where the
 * middle finger meets the palm). Used as the scale reference because the
 * wrist-to-middle-MCP segment is part of the rigid palm and barely
 * changes length across hand poses — unlike, say, wrist-to-fingertip,
 * which shortens and lengthens dramatically as fingers curl.
 */
const MIDDLE_MCP_INDEX = 9;

const EXPECTED_LANDMARK_COUNT = 21;

/**
 * LandmarkProcessor
 *
 * Converts raw MediaPipe hand landmarks (21 points in image-normalized
 * [0..1] space, as produced by HandTrackingService) into a fixed-length
 * feature vector suitable for feeding into a machine learning model.
 *
 * Why this is needed at all: raw landmarks are NOT good ML input as-is.
 * Their coordinates encode *where the hand is in the camera frame* and
 * *how far it is from the camera* just as strongly as they encode *what
 * shape the hand is making*. A gesture performed in the top-left corner
 * of the frame and the same gesture performed close-up in the center
 * would look like completely different vectors to a model, even though
 * the intent is identical. Each pipeline step below strips away one
 * source of irrelevant variation, so the only thing left varying between
 * feature vectors is hand *shape* — which is what the model should
 * actually be learning to classify.
 *
 * Pure, stateless transforms — safe to call from anywhere (React, a
 * training data export script, a Web Worker) without any setup.
 */
export class LandmarkProcessor {
  /**
   * Runs the full normalization pipeline and returns a flat 63-value
   * feature vector: [x0, y0, z0, x1, y1, z1, ..., x20, y20, z20].
   */
  static process(
    landmarks: HandLandmarks,
    handedness: Handedness | null,
    options: Partial<LandmarkProcessingOptions> = {}
  ): FeatureVector {
    LandmarkProcessor.assertValidInput(landmarks);
    const opts = { ...DEFAULT_LANDMARK_PROCESSING_OPTIONS, ...options };

    let points = LandmarkProcessor.centerOnWrist(landmarks);
    points = LandmarkProcessor.normalizeScale(points);

    if (opts.canonicalizeHandedness && handedness === "Left") {
      points = LandmarkProcessor.mirrorHorizontally(points);
    }

    return LandmarkProcessor.flatten(points);
  }

  /**
   * Step 1 — Wrist-centering (translation invariance).
   *
   * MediaPipe landmarks are normalized to the *camera frame*, not the
   * hand. The same gesture performed on the left side of the frame vs.
   * the right side produces entirely different raw coordinates, even
   * though it's the same gesture. Subtracting the wrist's position from
   * every point re-expresses the whole hand relative to its own root
   * joint, so only the hand's internal shape remains — where the hand
   * happens to be standing in the video no longer matters.
   */
  static centerOnWrist(landmarks: HandLandmarks): HandLandmarks {
    const wrist = landmarks[WRIST_INDEX];
    return landmarks.map((point) => ({
      x: point.x - wrist.x,
      y: point.y - wrist.y,
      z: point.z - wrist.z,
    }));
  }

  /**
   * Step 2 — Scale normalization (camera-distance invariance).
   *
   * A hand held close to the camera produces a larger spread of
   * coordinates than the same gesture held further away, even after
   * centering — the model would otherwise have to separately learn
   * "small version" and "large version" of every gesture. Dividing every
   * coordinate by the wrist-to-middle-MCP distance (a stable reference
   * length, since that segment is part of the rigid palm and doesn't
   * change as fingers move) rescales every sample to a consistent size.
   */
  static normalizeScale(landmarks: HandLandmarks): HandLandmarks {
    const reference = landmarks[MIDDLE_MCP_INDEX];
    const scale = Math.sqrt(reference.x ** 2 + reference.y ** 2 + reference.z ** 2);

    // Guard against division by zero on degenerate input (e.g. a
    // malformed frame where every point collapses to the wrist), which
    // would otherwise poison the whole vector with NaN/Infinity.
    const safeScale = scale > 1e-6 ? scale : 1;

    return landmarks.map((point) => ({
      x: point.x / safeScale,
      y: point.y / safeScale,
      z: point.z / safeScale,
    }));
  }

  /**
   * Step 3 — Left/right hand canonicalization.
   *
   * For the vast majority of signs, the left hand performing a gesture
   * is simply a mirror image of the right hand performing it — the
   * *meaning* is identical. Without this step, a classifier would need
   * roughly double the training data (separate examples per hand) to
   * learn a single gesture. Mirroring left-hand samples into the
   * right-hand frame lets every gesture pool training examples from
   * both hands instead of treating them as different classes.
   *
   * Only x is flipped: x is the axis that differs between a hand and
   * its mirror image (left-right). y (up/down) and z (near/far from
   * camera) are unaffected by handedness and stay untouched.
   */
  static mirrorHorizontally(landmarks: HandLandmarks): HandLandmarks {
    return landmarks.map((point) => ({
      x: -point.x,
      y: point.y,
      z: point.z,
    }));
  }

  /**
   * Step 4 — Flatten into a fixed-length feature vector.
   *
   * ML models expect a fixed-shape numeric input, not an array of
   * {x, y, z} objects. 21 landmarks * 3 coordinates = a 63-value vector,
   * always in the same [x0, y0, z0, x1, y1, z1, ...] order, so downstream
   * training code and inference code agree on what each index means.
   */
  static flatten(landmarks: HandLandmarks): FeatureVector {
    const vector: number[] = Array.from({ length: landmarks.length * 3 });
    landmarks.forEach((point, i) => {
      vector[i * 3] = point.x;
      vector[i * 3 + 1] = point.y;
      vector[i * 3 + 2] = point.z;
    });
    return vector;
  }

  private static assertValidInput(landmarks: HandLandmarks): void {
    if (landmarks.length !== EXPECTED_LANDMARK_COUNT) {
      throw new Error(
        `LandmarkProcessor expects exactly ${EXPECTED_LANDMARK_COUNT} landmarks, received ${landmarks.length}.`
      );
    }
  }
}
