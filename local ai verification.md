# Local AI Verification

**Method:** the codebase was actually searched for every network call (`fetch`, `XMLHttpRequest`, `axios`, hardcoded URLs) before writing this section, specifically to avoid asserting "runs on-device" without checking.

## 1. What runs fully on-device

| Component | Runs on-device via | Notes |
|---|---|---|
| Hand detection | MediaPipe Hands (WASM/WebGL, in-browser) | Processes every video frame locally; the video stream itself never leaves the device |
| Landmark normalization | `LandmarkProcessor.ts` (plain TypeScript) | Pure arithmetic, no I/O of any kind |
| Sign classification | `SignClassifierService.ts` (TensorFlow.js) | Runs the trained MLP locally via WebGL/WASM/CPU backend |
| Pose comparison | `PoseAnalysisService.ts` / `FingerAnalyzer` logic | Pure computation over already-local landmark data |
| Structured feedback rules | `PoseAnalysisService.ts` | Deterministic, on-device |
| Feedback **phrasing** (natural-language rewrite) | `LLMFeedbackService.ts`, via **WebLLM** (`@mlc-ai/web-llm`) running **on-device through WebGPU** | Verified by reading the source: a small local LLM (Qwen2.5-0.5B or similar, selected from `MODEL_CANDIDATES`), not a call to any cloud LLM API. Inference happens entirely in the browser's GPU via WebGPU — no prompt or response ever crosses the network. This was the component most worth double-checking, given how "LLM feedback" sounds by name — it checks out as on-device. |
| Feedback phrasing fallback | `utils/templateFeedback.ts` | Plain string templates, used when WebGPU/WebLLM isn't available |
| Progress statistics | `ProgressService.ts` | Reads/writes browser `localStorage` only |
| Lesson selection | `LessonEngine.ts` | Pure function over local `ProgressState`; the embedded spelling word list is a static bundled array, not fetched |
| Accuracy threshold preference | `useAccuracyThreshold.ts` | Local storage only |

Every frame of video, every landmark, every classification, every piece of feedback text, and all practice history stays on the device for the entire lifetime of a session.

## 2. What requires internet (and exactly when)

Two components fetch something remote, and **only once each, on first use** — after that, the browser's own cache serves them:

| Component | What it fetches | When | Size (approx.) |
|---|---|---|---|
| `HandTrackingService.ts` | The MediaPipe Hands runtime script + its WASM/model binaries, from `cdn.jsdelivr.net` | Once, on first page load (or first time hand tracking starts) | A few MB |
| `LLMFeedbackService.ts` | The WebLLM model weights (Qwen2.5-0.5B-Instruct or similar, quantized), from MLC's model distribution | Once, on first use of AI-phrased feedback — lazy-loaded, not on app boot | Several hundred MB — by far the largest network transfer in this app |

This app is not yet a true zero-network-guaranteed PWA (no service worker explicitly caching these) — it's "offline-capable after first load, informally," not "offline by explicit design contract." A hard offline guarantee would need self-hosting both assets, or a service worker with an explicit cache-first strategy.

**Static app files** (compiled JS/CSS, the classifier's `model.json`/weights, `labels.json`) load from whatever serves the app itself — ordinary web-app loading, not a runtime AI dependency.

## 3. Does any user data leave the device?

**No** — camera frames, hand landmarks, predicted signs, practice history, and feedback text are never transmitted anywhere, based on the audit above:

- **Video/camera data:** `getUserMedia` feeds a local `<video>` element directly; the stream never appears in any `fetch`/`XMLHttpRequest` call anywhere in the codebase.
- **Landmarks and classification results:** flow entirely through in-memory JS objects between local services/hooks.
- **The one `fetch()` call in the classification pipeline** (`SignClassifierService.ts`, loading `labels.json`) is a same-origin static file, not an external request.
- **LLM feedback:** the JSON payload built in `LLMFeedbackService.ts`'s `serializeForModel()` is passed directly to the local WebLLM engine object in-process — never sent over `fetch`.
- **Progress/statistics:** `ProgressService.ts` writes to `localStorage`, with no network component.

The only things that ever leave the device are the two one-time, anonymous model-asset downloads in §8.2 — generic binary files containing no user data, functionally identical to loading any other static asset.

## 4. Honest gaps in this verification

- This audit covers the application's own source code, not the internals of third-party dependencies (MediaPipe, TF.js, WebLLM) for any telemetry they might send independently — e.g. the `clearcut_uploader` log line observed during Python-side MediaPipe extraction (§3 of this report's development history) was exactly this kind of library-level telemetry attempt, which failed harmlessly offline. Fully ruling this out for the browser build would need a real network capture (DevTools Network tab, or a proxy) during a live session, not just a source-code read.
- No CI check currently enforces this staying true going forward (e.g. failing the build if a new external `fetch()` is introduced) — this reflects the codebase as audited, not an ongoing guarantee.

---
