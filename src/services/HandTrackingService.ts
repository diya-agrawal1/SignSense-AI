import type { Hands as HandsInstance, HandsConfig, Options, Results } from "@mediapipe/hands";
import type {
  HandTrackingOptions,
  HandTrackingResult,
  HandTrackingListener,
  Handedness,
} from "../models/handTracking";

const DEFAULT_OPTIONS: HandTrackingOptions = {
  maxNumHands: 1,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
};

const HANDS_SCRIPT_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js";

type HandsConstructor = new (config?: HandsConfig) => HandsInstance;

/**
 * @mediapipe/hands ships a legacy Closure-compiled script that attaches
 * `Hands` / `HAND_CONNECTIONS` onto `window` at runtime — it is NOT a real
 * ES module, even though its bundled .d.ts declares `export` statements
 * (that's a types-only convenience; Vite/Rollup will fail to bundle a
 * value import of it with a MISSING_EXPORT error). So we load it as a
 * plain <script> tag, same as MediaPipe's own official examples, and only
 * use its .d.ts for *type* imports (which are erased at compile time and
 * never touch the bundler).
 */
let scriptLoadPromise: Promise<void> | null = null;

function loadHandsRuntime(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("HandTrackingService can only run in a browser."));
  }
  if ((window as unknown as { Hands?: unknown }).Hands) {
    return Promise.resolve();
  }
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = HANDS_SCRIPT_URL;
    script.crossOrigin = "anonymous";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load the MediaPipe Hands runtime script."));
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

/**
 * HandTrackingService
 *
 * Wraps MediaPipe Hands to provide real-time, single-hand landmark
 * detection from a <video> element, entirely in-browser. Mirrors the
 * mediaDevicesService pattern: framework-agnostic, so it can be used
 * outside React or unit-tested independently.
 *
 * This class ONLY does detection — no canvases, no React. Consumers
 * subscribe via `subscribe()`; the same stream of results can later
 * feed both the SkeletonCanvas overlay AND an ML model layer.
 */
export class HandTrackingService {
  private handsPromise: Promise<HandsInstance>;
  private listeners: Set<HandTrackingListener> = new Set();
  private videoElement: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private running = false;
  private sending = false;

  constructor(options: Partial<HandTrackingOptions> = {}) {
    this.handsPromise = this.initHands(options);
  }

  private async initHands(options: Partial<HandTrackingOptions>): Promise<HandsInstance> {
    await loadHandsRuntime();

    const HandsCtor = (window as unknown as { Hands: HandsConstructor }).Hands;
    const instance = new HandsCtor({
      locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    const mergedOptions: Options = { ...DEFAULT_OPTIONS, ...options };
    instance.setOptions(mergedOptions);
    instance.onResults(this.handleResults);

    return instance;
  }

  /** Subscribe to landmark results. Returns an unsubscribe function. */
  subscribe(listener: HandTrackingListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Begin processing frames from the given (already-playing) video element. */
  start(videoElement: HTMLVideoElement): void {
    if (this.running) return;
    this.videoElement = videoElement;
    this.running = true;
    this.loop();
  }

  /** Stop the detection loop. Model stays warm; call start() again to resume. */
  stop(): void {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  /** Fully release MediaPipe/WASM resources. Instance is unusable after this. */
  async destroy(): Promise<void> {
    this.stop();
    this.listeners.clear();
    try {
      const hands = await this.handsPromise;
      await hands.close();
    } catch {
      // Runtime never finished loading — nothing to close.
    }
  }

  private loop = (): void => {
    if (!this.running || !this.videoElement) return;
    const videoElement = this.videoElement;

    if (!this.sending && videoElement.readyState >= 2) {
      this.sending = true;
      this.handsPromise
        .then((hands) => hands.send({ image: videoElement }))
        .catch((err: unknown) => {
          console.error("[HandTrackingService] frame processing error:", err);
        })
        .finally(() => {
          this.sending = false;
        });
    }

    if (this.running) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  };

  private handleResults = (results: Results): void => {
    const rawLandmarks = results.multiHandLandmarks?.[0] ?? null;
    const handednessInfo = results.multiHandedness?.[0] ?? null;

    const result: HandTrackingResult = {
      landmarks: rawLandmarks
        ? rawLandmarks.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }))
        : null,
      handedness: HandTrackingService.resolveHandedness(handednessInfo?.label),
      score: handednessInfo?.score ?? null,
      timestamp: performance.now(),
    };

    this.listeners.forEach((listener) => listener(result));
  };

  /**
   * MediaPipe's handedness classifier assumes the frame it receives is
   * already mirrored — i.e. captured "selfie style" (see the "Note" in
   * MediaPipe's Hands docs: "handedness is determined assuming the input
   * image is mirrored... If it is not the case, please swap the
   * handedness output in the application"). `selfieMode` is left unset
   * here, and `hands.send({ image: videoElement })` in `loop()` above
   * feeds the *raw* decoded video frame — the `scaleX(-1)` in
   * Camera.module.css only flips the on-screen `<video>` element for the
   * user's benefit; it has no effect on the underlying frame pixels
   * MediaPipe samples. So the frame reaching MediaPipe is NOT mirrored,
   * which means every label it returns is backwards relative to the
   * user's actual hand: a user signing with their right hand gets "Left"
   * back, and vice versa.
   *
   * This one-line swap corrects it at the source, so every downstream
   * consumer (LandmarkProcessor's handedness canonicalization, and
   * PoseAnalysisService's mirroring) sees the true hand. Left uncorrected,
   * this silently mirrors every feature vector along the wrong axis before
   * it ever reaches the classifier — especially damaging for signs like A
   * and L, where the thumb's exact left/right position relative to the
   * fist *is* the distinguishing feature: flipping it produces a shape the
   * model never saw in training, tanking confidence or causing a
   * misclassification, while shapes that don't depend so heavily on thumb
   * laterality degrade far less visibly.
   */
  private static resolveHandedness(label: string | undefined): Handedness | null {
    if (label !== "Left" && label !== "Right") return null;
    return label === "Left" ? "Right" : "Left";
  }
}
