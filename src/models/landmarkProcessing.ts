/**
 * Domain types for turning raw hand landmarks into ML-ready features.
 * Kept separate from handTracking.ts since this describes a downstream
 * transformation, not detection output.
 */

/** 21 landmarks * (x, y, z) each, flattened row-major: [x0,y0,z0, x1,y1,z1, ...]. */
export type FeatureVector = number[];

export interface LandmarkProcessingOptions {
  /**
   * When true (default), landmarks detected as the left hand are mirrored
   * along x so every sample ends up expressed in a single canonical
   * "right hand" frame. Turn this off if your model needs to distinguish
   * left vs. right hand explicitly (e.g. two-handed signs where which
   * hand is which carries meaning).
   */
  canonicalizeHandedness: boolean;
}

export const DEFAULT_LANDMARK_PROCESSING_OPTIONS: LandmarkProcessingOptions = {
  canonicalizeHandedness: true,
};
