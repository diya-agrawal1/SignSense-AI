# SignSense-AI — Technical Report: ASL Classifier Model

## 1. Model Overview

| | |
|---|---|
| Task | 24-class ASL alphabet classification (A–Y, excluding J and Z, which require motion) |
| Input | 63-value feature vector — 21 hand landmarks × (x, y, z), normalized by `LandmarkProcessor.ts` |
| Architecture | `Dense(128, relu) → BatchNorm → Dropout(0.3) → Dense(64, relu) → Dropout(0.3) → Dense(24, softmax)` |
| Parameters | 18,264 total — verified two ways: from the layer shapes (63×128+128) + 256 (folded BatchNorm) + (128×64+64) + (64×24+24) = 18,264, and independently confirmed by group1-shard1of1.bin's exact file size (18,264 bytes — each parameter is stored as one uint8 byte, so the file size is the count).|
| Framework | TensorFlow / Keras, trained offline in Python |
| Deployment | TensorFlow.js graph model, run client-side by `SignClassifierService.ts` |
| Hand detection | MediaPipe Hands (`@mediapipe/hands`), loaded via `HandTrackingService.ts` |

The Dropout(0.3) rate comes from the original training script, which isn't included in this bundle — it can't be independently verified from the exported model itself, since dropout layers are removed from the inference graph. Treat it as reported, not re-confirmed.

## 2. Preprocessing

Before the model sees any input, `LandmarkProcessor.ts` transforms the raw 21 landmarks:

1. **Wrist-centering** — subtract the wrist position from every point, so the hand's position in the camera frame doesn't matter.
2. **Scale normalization** — divide by the wrist-to-middle-knuckle distance, so distance from the camera doesn't matter.
3. **Handedness canonicalization** — mirror left-hand landmarks to match right-hand orientation, so one gesture only needs one set of training examples.
4. **Flatten** — output a single 63-number array.

This preprocessing is why a small 18.3K-parameter network is enough — the model only ever has to learn hand *shape*, not position or scale.

## 3. Quantization

The exported model uses post-training **uint8 quantization**: every weight tensor in `model.json`'s `weightsManifest` stores a `quantization: {dtype: uint8, min, scale}` block instead of raw float32 values. This cuts weight storage roughly 4x versus float32, with weights decompressed back to float32 at load time before inference.

## 4. Model Size

| File | Size |
|---|---|
| `model.json` | 7,406 bytes |
| `group1-shard1of1.bin` | 18,264 bytes |
| `labels.json` | 170 bytes |
| **Total** | **25,840 bytes (~25.2 KB)** |

## 5. Inference Performance

Benchmarked by running 500 predictions against the real exported model file:

| Metric | Value |
|---|---|
| Model load time | 125.5 ms |
| Mean inference latency | 0.92 ms |
| p50 | 0.33 ms |
| p95 | 4.01 ms |
| p99 | 10.02 ms |
| Throughput (mean-based) | ~1,087 predictions/sec |

The app itself throttles classification to 5 predictions/sec (`PREDICTION_INTERVAL_MS = 200` in `useSignClassifier.ts`) — well within the model's capacity. Each `predict()` call runs inside `tf.tidy()` in `SignClassifierService.ts`, which frees intermediate tensors after each call to keep memory flat over a session.

These numbers come from a Node.js benchmark against the exported model file on a plain CPU backend — not a browser. It's a valid lower bound (proves the model itself is cheap to run), but not what a user's actual browser session will measure, since browsers typically use a GPU-accelerated (WebGL) backend with different overhead characteristics. Real-browser latency hasn't been measured yet.

## 6. CPU / GPU Usage

- **Hand detection** (MediaPipe Hands, WASM) is the main CPU cost in the pipeline — it runs on every video frame.
- **Classification** runs through TensorFlow.js, which uses WebGL by default in the browser when available, falling back to WASM or CPU otherwise. `SignClassifierService.ts` doesn't pin a specific backend — it uses whatever `tf.getBackend()` resolves to.
- **NPU:** not used. TensorFlow.js has no NPU backend in this project's dependencies.

## 7. Privacy and Data Handling

| Data | Handling |
|---|---|
| Camera frames | Processed in-memory per frame, never stored or transmitted |
| Hand landmarks | Transient, in-memory only |
| Practice statistics | Saved to `localStorage` under `signsense.progress.v1` (`ProgressService.ts`) — the only persisted data |
| Feedback text | Displayed only, never logged |

**Permissions requested:** camera (`getUserMedia`, via `mediaDevicesService.ts`) for hand tracking. WebGPU is checked as a capability (`'gpu' in navigator`), not requested as a permission — it enables on-device LLM feedback phrasing, and the app falls back to template-based feedback (`utils/templateFeedback.ts`) if it's unavailable.

No accounts, no user identifiers, no analytics or telemetry calls exist in the application's own source code. No data is stored server-side, because there is no server.

## 8. Attribution

**Pretrained models used:**

| Model | Publisher | Used for |
|---|---|---|
| MediaPipe Hands | Google | Hand landmark detection |
| Qwen2.5-0.5B-Instruct / Qwen2-0.5B-Instruct / Qwen2.5-1.5B-Instruct | Alibaba (Qwen team), via MLC-AI | On-device feedback phrasing (`LLMFeedbackService.ts`), selected in priority order from `MODEL_CANDIDATES` |
| Llama-3.2-1B-Instruct | Meta, via MLC-AI | Fallback feedback-phrasing model if no Qwen candidate is available |

**Dataset:** [ASL Alphabet](https://www.kaggle.com/datasets/grassknoted/asl-alphabet) (Kaggle, uploaded by grassknoted) — 87,000 source images, 55,368 successfully processed into landmark vectors for training.

**Libraries:**

| Library | Version | Purpose |
|---|---|---|
| React / react-dom | ^19.2.7 | UI framework |
| TypeScript | ~6.0.2 | Language |
| Vite | ^8.1.1 | Build tool |
| `@mediapipe/hands` | ^0.4.1675469240 | Hand landmark detection |
| `@tensorflow/tfjs` | ^4.22.0 | Classifier inference |
| `@mlc-ai/web-llm` | ^0.2.79 | On-device LLM feedback |
| oxlint | ^1.71.0 | Linting |

**Original work:** `LandmarkProcessor.ts`, `HandTrackingService.ts`, `SignClassifierService.ts`, `PoseAnalysisService.ts`, `LessonEngine.ts`, `ProgressService.ts`, `LLMFeedbackService.ts`, `mediaDevicesService.ts`, and all UI components, hooks, and pages were written for this project.
