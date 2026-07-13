import type { LetterReference } from "./poseAnalysis";

/**
 * Expected hand shape for each letter of the ASL manual alphabet.
 * See the doc-comment on LetterReference (models/poseAnalysis.ts) for the
 * known simplifications baked into this table — tune freely as you test
 * against real signing.
 *
 * J and Z are conventionally traced with motion; the shapes below are the
 * closest static-frame approximation (I-hand for J, index-point for Z).
 */
export const ASL_ALPHABET_REFERENCE: Record<string, LetterReference> = {
  A: { fingers: { thumb: "extended", index: "curled", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingAway" },
  B: { fingers: { thumb: "curled", index: "extended", middle: "extended", ring: "extended", pinky: "extended" }, palmOrientation: "facingCamera" },
  C: { fingers: { thumb: "halfCurled", index: "halfCurled", middle: "halfCurled", ring: "halfCurled", pinky: "halfCurled" } },
  D: { fingers: { thumb: "halfCurled", index: "extended", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  E: { fingers: { thumb: "curled", index: "curled", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  F: { fingers: { thumb: "halfCurled", index: "halfCurled", middle: "extended", ring: "extended", pinky: "extended" }, palmOrientation: "facingCamera" },
  G: { fingers: { thumb: "halfCurled", index: "extended", middle: "curled", ring: "curled", pinky: "curled" } },
  H: { fingers: { thumb: "curled", index: "extended", middle: "extended", ring: "curled", pinky: "curled" } },
  I: { fingers: { thumb: "curled", index: "curled", middle: "curled", ring: "curled", pinky: "extended" }, palmOrientation: "facingCamera" },
  J: { fingers: { thumb: "curled", index: "curled", middle: "curled", ring: "curled", pinky: "extended" } },
  K: { fingers: { thumb: "halfCurled", index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  L: { fingers: { thumb: "extended", index: "extended", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  M: { fingers: { thumb: "curled", index: "curled", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingAway" },
  N: { fingers: { thumb: "curled", index: "curled", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingAway" },
  O: { fingers: { thumb: "halfCurled", index: "halfCurled", middle: "halfCurled", ring: "halfCurled", pinky: "halfCurled" }, palmOrientation: "facingCamera" },
  P: { fingers: { thumb: "halfCurled", index: "extended", middle: "extended", ring: "curled", pinky: "curled" } },
  Q: { fingers: { thumb: "halfCurled", index: "extended", middle: "curled", ring: "curled", pinky: "curled" } },
  R: { fingers: { thumb: "curled", index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  S: { fingers: { thumb: "curled", index: "curled", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingAway" },
  T: { fingers: { thumb: "curled", index: "curled", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingAway" },
  U: { fingers: { thumb: "curled", index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  V: { fingers: { thumb: "curled", index: "extended", middle: "extended", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  W: { fingers: { thumb: "curled", index: "extended", middle: "extended", ring: "extended", pinky: "curled" }, palmOrientation: "facingCamera" },
  X: { fingers: { thumb: "curled", index: "halfCurled", middle: "curled", ring: "curled", pinky: "curled" }, palmOrientation: "facingCamera" },
  Y: { fingers: { thumb: "extended", index: "curled", middle: "curled", ring: "curled", pinky: "extended" }, palmOrientation: "facingCamera" },
  Z: { fingers: { thumb: "curled", index: "extended", middle: "curled", ring: "curled", pinky: "curled" } },
};
