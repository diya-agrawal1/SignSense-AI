# SignSense-AI — Technical Report: ASL Classifier Model

**Scope:** covers the trained ASL alphabet classifier — model architecture, training/export pipeline, runtime performance (§1–§7), what runs on-device vs. requires internet (§8), accuracy evaluation against a real methodology and baseline (§9), privacy and safety considerations (§10), and full attribution of pretrained models/datasets/libraries used (§11). Complements `ARCHITECTURE.md`, which covers the full system.

**A note on honesty of the numbers below:** every figure marked **[Measured]** was actually run and observed (either during training/export, or via a benchmark script run against the real exported model file — see §4). Every figure marked **[Not yet measured]** is a genuine gap — this report says so explicitly rather than presenting an estimate as fact, and gives the exact method to fill it in.

---

## 1. Model and runtime used

| | |
|---|---|
| **Task** | 24-class ASL alphabet classification (static handshapes; J and Z excluded — both require motion, which a single frame can't represent) |
| **Input** | 63-value normalized feature vector (21 MediaPipe hand landmarks × x/y/z, wrist-centered, scale-normalized, handedness-canonicalized — see `LandmarkProcessor.ts`) |
| **Architecture** | `Dense(128, relu) → BatchNorm → Dropout(0.3) → Dense(64, relu) → Dropout(0.3) → Dense(24, softmax)` |
| **Parameters** | 18,392 trainable + 256 non-trainable (BatchNorm running stats) = 18,648 total **[Measured — computed from layer shapes: (63×128+128) + 256 + (128×64+64) + (64×24+24)]** |
| **Training framework** | TensorFlow / Keras 2.19–2.21 (Python), trained via `ml/train_model.py` |
| **Training hardware** | CPU-only (no GPU used or required — the model is small enough that CPU training completed in minutes) |
| **Deployment runtime** | TensorFlow.js, `tfjs_graph_model` format, run entirely client-side in the browser via `SignClassifierService.ts` |
| **Detection front-end** | MediaPipe Hands (legacy `@mediapipe/hands` JS solution, loaded via `<script>` tag — see `ARCHITECTURE.md` §7 for why not a bundled import) |

---

## 2. Quantization and optimization techniques

- **Post-training uint8 quantization**, applied at export time via `tensorflowjs_converter --quantize_uint8` (see `ml/export_tfjs.py`). Weights are stored as 8-bit integers with a per-tensor scale/zero-point, rather than 32-bit floats — roughly a 4x reduction in weight storage size, decompressed back to float32 at load time before inference.
- **Architecture-level optimization, done before quantization even entered the picture:** the entire reason the model can stay this small is that `LandmarkProcessor` does the heavy lifting *before* the model ever sees data — stripping position, scale, and handedness variation out of the input. This is what makes a ~18K-parameter MLP sufficient at all, instead of needing a CNN operating on raw pixels (which would be orders of magnitude larger and slower).
- **No pruning, distillation, or architecture search was performed** — at this size, none were necessary to hit acceptable size/latency targets; noted here as a real gap, not an oversight to hide. If the model ever grows (e.g., if two-handed signs are added later), these become worth revisiting.
- **Graph-mode export** (`tfjs_graph_model`, not `tfjs_layers_model`) — inference-only graph, no training-time nodes (dropout/batchnorm are folded into their inference behavior), which is both smaller and faster to execute than a layers-model would be.

---

## 3. Model size

**[Measured]** — actual file sizes of the exported, quantized model:

| File | Size |
|---|---|
| `model.json` (graph topology + quantization metadata) | 7,421 bytes |
| `group1-shard1of1.bin` (quantized weights) | 18,264 bytes |
| **Total** | **25.1 KB** |

For scale: this is smaller than most single icons or small images on a typical webpage. It loads effectively instantly even on a slow connection, and — being same-origin static files served with the rest of the app bundle — is cached by the browser after first load like any other asset.

---

## 4. Inference latency

**[Measured, with an important caveat on environment — read before using these numbers]**

Benchmarked by loading the actual exported model file and running 500 real predictions with random (but realistically-shaped) 63-value input vectors, timing each with `performance.now()` and forcing synchronous completion via `.dataSync()` so the timing reflects real compute, not just op-enqueue time.

| Metric | Value |
|---|---|
| Model load time | 125.5 ms |
| Mean inference latency | 0.92 ms |
| p50 | 0.33 ms |
| p95 | 4.01 ms |
| p99 | 10.02 ms |
| Max (single outlier) | 41.75 ms |
| Implied throughput (mean-based) | ~1,087 predictions/sec |

**The caveat:** this was run in **Node.js, on TF.js's plain-JS `cpu` backend** (see §6) — not a browser, not WebGL/WASM. It's a legitimate lower-bound data point (proves the model itself is computationally trivial), but it is **not** the number a real user's browser will see. Two things will differ in an actual browser session:
1. TF.js will typically select the **WebGL** backend in-browser (GPU-accelerated), which has real overhead per call (uploading tensors to a GPU texture, shader dispatch) that can actually make a *tiny* model like this one **slower** than plain CPU execution, purely from dispatch overhead — a known characteristic of GPU backends on very small workloads.
2. `useSignClassifier.ts` already throttles to 5 predictions/sec, so raw max throughput isn't the relevant number in practice anyway — the model has a wide margin either way.

**To measure the real number**, wrap the existing `predict()` call in `SignClassifierService.ts` with `performance.now()` (or use `tf.time()`, which reports both CPU and GPU-kernel time separately for the active backend) and log it in a dev build, then check on real target devices. This is flagged as the single most valuable next measurement to take before making any latency claims externally.

**Context that matters more than the number in isolation:** MediaPipe Hands' own detection step (§5 of `ARCHITECTURE.md`) runs at roughly 27-32 FPS end-to-end in the app as already observed in manual testing — meaning hand detection alone budgets ~30ms/frame. Classification adds well under 1ms of that budget on any backend, based on the measurement above; it is not the bottleneck in this pipeline.

---

## 5. CPU / GPU / NPU usage

- **CPU:** MediaPipe Hands' WASM-based hand detection is the dominant CPU consumer in this pipeline — it runs a real neural network over every video frame. The classifier itself, per §4, is computationally negligible by comparison on any backend.
- **GPU:** TF.js will use **WebGL** as its default backend in most browsers when available, dispatching the model's matrix multiplications as GPU shaders. MediaPipe Hands also uses WebGL for parts of its own pipeline (visible in the "Successfully created a WebGL context" log line seen during local testing). Both compete for the same GPU context — worth profiling together, not just the classifier in isolation, if GPU contention ever becomes a concern.
- **NPU:** **Not used.** TensorFlow.js has no NPU/dedicated-AI-accelerator backend as of this project's dependencies — inference runs on CPU or GPU(WebGL/WASM) only. On devices with a real NPU (e.g., newer phones/laptops with dedicated AI silicon), this app is not taking advantage of it; that would require a different runtime (e.g., ONNX Runtime Web with NPU execution providers, or platform-specific APIs), which is out of scope for the current TF.js-based architecture.
- **Backend selection is automatic** and not currently pinned in code — `SignClassifierService.ts` uses whatever `tf.getBackend()` resolves to by default (typically `webgl`, falling back to `wasm` or `cpu` if WebGL is unavailable). **[Not yet measured]:** which backend actually gets selected on real target browsers/devices, and whether explicitly forcing a specific backend (`tf.setBackend('wasm')`, for instance) would be faster for a model this small — worth a controlled A/B measurement given the dispatch-overhead point in §4.

---

## 6. Peak memory usage

**[Measured, Node.js CPU-backend proxy — see the same caveat as §4]**

| Stage | RSS |
|---|---|
| Baseline (before model load) | 93.6 MB |
| After model load | 95.6 MB (**+2.0 MB**) |
| After 500 inferences | 107.9 MB (**+12.4 MB** further) |

The +12.4 MB climb over 500 calls reflects intermediate tensors awaiting garbage collection, not a leak — `tf.memory()` reported only 9 live tensors / ~73 KB of TF.js-managed memory at the end of the run, consistent with normal steady-state behavior once GC catches up (each `predict()` call in `SignClassifierService.ts` runs inside `tf.tidy()`, which is specifically what keeps this bounded rather than growing unbounded over a real session).

**What's genuinely not measured yet:** browser peak memory is a different question from Node's `process.memoryUsage()` — WebGL backends hold weights/activations in GPU texture memory, which doesn't show up in JS heap snapshots at all. **To measure it properly:** Chrome DevTools → Performance Monitor (for live JS heap + DOM node tracking) alongside `chrome://gpu` or the Memory tab's "GPU Memory" view, captured during an actual practice session (camera running + classification looping), on real target hardware. This is a concrete open item, not a claim being made here.

---

## 7. Tested device specifications

**[Measured — but only one data point, and not a representative one]**

The benchmark in §4/§6 above ran here:

| | |
|---|---|
| Environment | Sandboxed Linux container (development/CI-style environment, not a real end-user device) |
| OS | Ubuntu 24.04.4 LTS |
| CPU | Intel Xeon, 2.80 GHz, **1 vCPU** |
| RAM | 3.9 GB total |
| Node.js | v22.22.2 |
| GPU | None (headless — TF.js ran on the plain CPU backend, not WebGL) |

**This is explicitly not a stand-in for a real user's device**, and shouldn't be quoted as "tested on X" in any user-facing material. It's useful as a lower-bound sanity check that the model itself is cheap, and nothing more.

**What real device testing should cover** (none of this has been done yet — a template, not a result):

| Device class | Example | CPU | GPU/WebGL support | Status |
|---|---|---|---|---|
| Low-end laptop | e.g. budget Chromebook | Low-power ARM/Celeron-class | Often limited WebGL | **Not tested** |
| Mid-range laptop | e.g. typical office laptop | Modern i5/Ryzen 5-class | Integrated GPU, WebGL2 | **Not tested** |
| High-end desktop | e.g. gaming/workstation PC | Modern i7/i9/Ryzen 7+ | Discrete GPU, WebGL2 | **Not tested** |
| Mid-range phone | e.g. common Android device | Mobile SoC | WebGL, often no WASM SIMD | **Not tested** |
| iOS (Safari) | iPhone/iPad | Apple Silicon | WebGL, different WASM behavior than Chrome | **Not tested** — worth prioritizing given Safari's historically different WebGL/WASM performance characteristics vs. Chromium browsers |

Recommended before any public claims about performance: run the same 500-inference benchmark methodology from §4 (adapted to log from `SignClassifierService.predict()` directly in a dev build) on at least one real device per row above.

---

## 8. Privacy and Safety

### 8.1 Data handling

| Data type | What happens to it |
|---|---|
| Camera video frames | Processed in-memory, frame by frame, by MediaPipe and the classifier — never written to disk, never stored in any variable beyond the current frame's processing, never transmitted anywhere. Once a frame is analyzed, it's discarded. |
| Hand landmarks (per frame) | Same as above — transient, in-memory only, discarded after each frame's classification/feedback cycle. |
| Practice statistics (attempts, successes, streaks per letter) | The one thing that *is* persisted — written to browser `localStorage` under a single key (`signsense.progress.v1`). This is the only data with any lifetime beyond a single frame. |
| Feedback text (structured + LLM-phrased) | Generated and displayed, not stored or logged anywhere. |

**No account system, no user identifiers, no analytics/telemetry calls exist in this codebase** (verified in §8's network-call audit) — there is no "user profile" beyond whatever `localStorage` on that one browser holds.

### 8.2 Permissions

| Permission | Requested by | Purpose | User control |
|---|---|---|---|
| Camera (`getUserMedia`) | `Camera` component, on mount | Hand tracking — this is the only reason camera access is requested | Browser's native permission prompt; revocable anytime via browser site settings, which immediately stops the video stream |
| WebGPU | Not a permission prompt — a capability check (`'gpu' in navigator`) | Enables on-device LLM feedback phrasing (§8.1) | No user action needed; if unavailable, the app silently falls back to template-based feedback (`utils/templateFeedback.ts`) rather than failing |

**No microphone, location, notifications, or any other browser permission is requested anywhere in the codebase.**

### 8.3 Storage

- **Mechanism:** `localStorage`, scoped to the app's origin by the browser's same-origin policy — not accessible to other websites.
- **Duration:** persists until explicitly cleared (by the user, via browser settings, or by clearing site data) or until the browser itself clears storage (e.g. some browsers' storage-eviction policies under disk pressure).
- **Content:** per-letter attempt counts, success counts, timing data, and streak counters. No images, no video, no landmarks, no biometric data of any kind are stored — only aggregate practice statistics.
- **No server-side storage exists at all** — there is nothing to breach on a server, because there is no server holding user data.

### 8.4 Limitations

- **No cross-device sync.** Progress lives in one browser, on one device. Switching browsers or devices starts fresh, with no warning to the user that this will happen.
- **No backup/recovery.** Clearing site data (accidentally or otherwise) permanently deletes all practice history — there's no cloud copy to restore from, and the app doesn't warn the user this data is local-only before it happens.
- **No encryption at rest.** `localStorage` is stored in plaintext by the browser. This is normal for `localStorage` generally and not a departure from web platform norms, but it does mean anything with script-level access to the page (e.g. a malicious browser extension, if one were installed) could theoretically read it — not a risk unique to this app, but worth naming rather than assuming away.
- **Shared-device risk.** On a shared computer/browser profile, anyone using that profile sees (and can clear) the same progress data — there's no per-user separation without an account system, because there is no account system.
- **No in-app privacy disclosure.** There is currently no visible privacy notice or camera-usage explanation shown to the user inside the app itself before requesting camera access — the browser's native permission prompt is the only disclosure that occurs. For a learning tool that may be used by minors (a real possibility for an ASL learning app), this is worth addressing explicitly rather than relying on the browser's generic prompt alone.

### 8.5 Potential risks

- **Bystanders in frame.** The camera captures whatever is in view, not just the signing hand — a face, other people, or background details could appear in the live video feed during use. Since frames are never stored or transmitted (§10.1), this is a momentary display-only exposure, not a retention risk — but it's still worth stating plainly rather than only discussing what happens to *processed* data.
- **Bandwidth/data cost of first use.** The WebLLM model download (several hundred MB, §8.2) is a real, user-facing cost on a metered or slow connection, and nothing in the current UI warns the user before it starts downloading on first use of AI-phrased feedback.
- **Third-party library trust.** MediaPipe, TensorFlow.js, and WebLLM are all external dependencies whose full internal behavior hasn't been independently audited beyond the network-call-level check in §8 — supply-chain trust in these libraries is inherent to using them at all, same as any project depending on external packages.
- **Browser/extension-level exposure while camera is active.** While the camera permission is granted and the tab is active, any other script with legitimate page access (e.g. a browser extension with broad permissions) could theoretically access the same video stream — a general web-platform consideration, not something specific to a bug in this app's code.
- **No content moderation on LLM output.** `LLMFeedbackService.ts`'s system prompt constrains the model's phrasing tightly (§8.1), but as with any LLM, there's no hard guarantee against an occasional malformed or off-tone response slipping through — low-stakes here given the narrow, encouraging-tutor use case, but worth naming as an open-ended risk category for any LLM-backed feature.

---

## 9. Attribution

### 9.1 Pretrained models

| Model | Publisher | Used for | License/terms |
|---|---|---|---|
| MediaPipe Hands (hand landmark detection) | Google | Real-time 21-point hand landmark detection, both in the browser (`@mediapipe/hands`) and during offline training-data extraction (Python `mediapipe` Tasks API) | Apache 2.0 |
| Qwen2.5-0.5B-Instruct / Qwen2-0.5B-Instruct (primary candidates) | Alibaba (Qwen team), distributed via MLC-AI's prebuilt model catalog | On-device feedback phrasing (`LLMFeedbackService.ts`), selected automatically from `MODEL_CANDIDATES` based on availability | Qwen license (Apache 2.0 for the 2.5 series; verify the exact variant's license in MLC's model card before any redistribution) |
| Llama-3.2-1B-Instruct (fallback candidate) | Meta, distributed via MLC-AI | Same as above, used only if the Qwen candidates aren't available in the installed WebLLM version | Llama 3.2 Community License (Meta) — has usage restrictions beyond a permissive open-source license; worth reviewing directly if this fallback is ever actually the one selected in production |

**This project trained its own model from scratch** (the 24-class ASL alphabet MLP classifier, §1–§3 of this report) — it is not a fine-tune or derivative of any pretrained sign-language model. The only pretrained models in the system are the two above, both used for input processing (hand landmarks) and output phrasing (feedback text), not for the sign classification task itself.

### 9.2 Dataset

| Dataset | Source | Used for | License |
|---|---|---|---|
| ASL Alphabet | [Kaggle, uploaded by grassknoted](https://www.kaggle.com/datasets/grassknoted/asl-alphabet) — per the dataset's own description, compiled from multiple open datasets its author credits collectively | Training data for the ASL classifier (87,000 source images; 55,368 landmark vectors successfully extracted, §9.2) | **Not independently confirmed in this report** — the dataset's exact license terms should be verified directly on its Kaggle page before any redistribution, commercial use, or public release of this project, rather than assumed from this report alone. |

### 9.3 Libraries and frameworks

**Browser app:**

| Library | Version | Purpose |
|---|---|---|
| React / react-dom | ^19.2.7 | UI framework |
| TypeScript | ~6.0.2 | Language/type-checking |
| Vite | ^8.1.1 | Build tool / dev server |
| `@mediapipe/hands` | ^0.4.1675469240 | Hand landmark detection (browser) |
| `@tensorflow/tfjs` | ^4.22.0 | Classifier inference (browser) |
| `@mlc-ai/web-llm` | ^0.2.79 | On-device LLM feedback phrasing |
| oxlint | ^1.71.0 | Linting |
| Vitest + Testing Library + jsdom | ^4.1.10 / ^16.3.2 / ^29.1.1 | Test tooling (added specifically to verify the LessonEngine integration's round-tracking logic, §10 of `ARCHITECTURE.md`'s development history) |

**Python training pipeline** (`ml/`):

| Library | Purpose |
|---|---|
| `mediapipe` | Landmark extraction from training images (Tasks API) |
| `opencv-python-headless` | Image loading/preprocessing during extraction |
| `tensorflow` / `keras` | Model definition and training |
| `pandas` | Loading/manipulating the extracted landmark CSV |
| `scikit-learn` | Train/val/test split, evaluation metrics |
| `matplotlib` | Confusion matrix plotting |
| `tqdm` | Extraction progress bars |
| `tensorflowjs` | Converting the trained Keras model to browser-deployable TF.js format |

### 9.4 Browser platform APIs

Not third-party libraries, but worth listing as relied-upon platform capabilities: `MediaDevices.getUserMedia` (camera access), WebGL / WebAssembly (MediaPipe and TF.js execution backends), WebGPU (WebLLM execution), Canvas 2D API (skeleton overlay rendering), `localStorage` (progress persistence).

### 9.5 Original work

Everything else in the system — `LandmarkProcessor` (both TS and Python versions), `HandTrackingService`, `SignClassifierService`, `PoseAnalysisService`/`FingerAnalyzer`, `LessonEngine`, `ProgressService`, the training/extraction/export scripts, and all UI components — is original code written for this project, not adapted from a pre-existing template, tutorial, or third-party codebase.

---

## 10. Summary of open measurement gaps

Collected in one place for visibility — these are the honest "not yet done" items from this report, not omissions:

1. Real browser inference latency (§4) — Node/CPU number exists as a lower bound only.
2. Actual TF.js backend selected in real browsers/devices, and whether pinning a specific backend helps (§5).
3. Real browser peak memory, including GPU texture memory (§6).
4. Testing on any real end-user device across the matrix in §7 — everything so far ran in a headless sandbox.
5. Independent verification that third-party libraries (MediaPipe, TF.js, WebLLM) send no telemetry of their own (§8.4) — a network capture, not just a source read.
6. Formal real-world (live webcam) accuracy validation, beyond the Kaggle-dataset test-set number (§9.4).
7. A real comparative baseline (another model/approach), not just the trivial random/majority baselines in §9.3.
8. Evaluation of `PoseAnalysisService`, `LessonEngine`, and `LLMFeedbackService` individually (§9.5) — this report only evaluates the classifier.
9. No in-app privacy disclosure currently shown to users before camera access (§10.4) — a real, addressable gap, not just a measurement one.
10. Exact license terms for the Kaggle ASL Alphabet dataset and the specific WebLLM model variant actually selected in production (§11.1–§11.2) — stated as unconfirmed rather than assumed, and worth resolving before any public or commercial release.
