# 🏗️ SignSense AI – Architecture

This document describes the technical architecture of **SignSense AI**, an offline AI-powered tutor for learning American Sign Language (ASL) fingerspelling.

For deeper detail on the classifier model itself (parameters, quantization, latency, accuracy), see `TechnicalReport.md` and `evaluation.md`. For a full audit of what runs on-device vs. what touches the network, see `local-ai-verification.md`.

---

# 🍕 High-Level Architecture

```text
                         Browser
                            │
                            ▼
                    Webcam (getUserMedia)
                            │
                            ▼
                  MediaPipe Hands Model
                 (21 Hand Landmarks)
                            │
                            ▼
                 Landmark Preprocessing
            (Normalization & Feature Vector)
                            │
                            ▼
              Custom MLP Gesture Classifier
                 (TensorFlow.js Model)
                            │
                            ▼
          Predicted Letter + Confidence Score
                     │                │
                     ▼                ▼
             Pose Analysis      Progress Tracker
                     │
                     ▼
             Feedback Generation
          (rule-based text, optionally
           rephrased by an on-device LLM)
                     │
                     ▼
               React User Interface
```

---

# 🍕 Architecture Overview

The application is built around an **entirely client-side pipeline**. Every stage — from image acquisition to gesture recognition to feedback phrasing — runs locally inside the browser.

There are **no backend APIs**, **no cloud inference**, and **no video uploads**.

This architecture provides:

- Low latency
- Offline functionality (after first load — see the caveat in `local-ai-verification.md` about the two one-time asset downloads)
- Privacy-preserving inference
- Cross-platform browser compatibility

---

# 🍕 Component Breakdown

## 1. Camera Module

**Technology**

- Browser `getUserMedia()` API, wrapped by `mediaDevicesService.ts` and the `Camera` component / `useCamera` hook

### Responsibilities

- Request camera permission
- Stream live webcam frames
- Handle camera errors
- Feed frames to MediaPipe

**Input**

None

**Output**

Live video stream

---

## 2. Hand Tracking

**Technology**

MediaPipe Hands (`@mediapipe/hands`, loaded via `HandTrackingService.ts`)

### Responsibilities

- Detect a hand
- Track movement across frames
- Estimate 21 hand landmarks

**Input**

Video frame

**Output**

```text
21 Landmarks

(x, y, z)
```

These landmarks describe the position of every important finger joint.

---

## 3. Landmark Processor

Raw landmark coordinates vary depending on camera distance and hand position.

Before inference, they are normalized by `LandmarkProcessor.ts`.

### Processing Steps

- Wrist-centered translation
- Scale normalization
- Handedness canonicalization
- Feature vector generation

Output:

```text
63 Features

21 × (x, y, z)
```

These normalized values become the input for the classifier.

---

## 4. Gesture Classification

This is the project's primary AI model, served by `SignClassifierService.ts`.

### Model

Lightweight Multi-Layer Perceptron (MLP)

### Input

63 normalized landmark values

### Output

- Predicted ASL letter (one of 24 — A through Y, excluding J and Z, since both require motion a single static frame can't represent)
- Confidence score

Example

```text
Prediction

Letter : G

Confidence : 97%
```

The model executes locally using TensorFlow.js. See `TechnicalReport.md` for the model's exact architecture, size, and measured latency.

---

## 5. Pose Analysis

The predicted letter alone is not enough for learning.

`PoseAnalysisService.ts` compares the detected hand pose against the expected pose for the target letter.

It evaluates:

- Finger extension
- Finger curl
- Relative finger positions
- Palm orientation

Example feedback:

```
✓ Thumb correct

✗ Index finger too bent

✓ Middle finger correct

Suggestion:
Straighten your index finger slightly.
```

Unlike the classifier, this module uses deterministic geometric calculations rather than machine learning.

---

## 6. Feedback Engine

The feedback engine converts pose analysis into learner-friendly suggestions, via `utils/templateFeedback.ts` (deterministic templates) and, when available, `LLMFeedbackService.ts` (on-device LLM rephrasing — see §8 below).

Responsibilities include:

- Display detected letter
- Show confidence score
- Highlight incorrect fingers
- Generate corrective hints

This component acts as the tutoring layer of the application.

---

## 7. Progress Tracking

User progress is stored locally using browser `localStorage`, via `ProgressService.ts`.

Tracked information includes:

- Accuracy
- Total attempts
- Recently practiced letters
- Weak letters
- Practice history

Since everything is stored locally, no user information leaves the device.

---

# 🍕 Frontend Architecture

```text
App
│
├── pages/
│   ├── DashboardPage
│   └── TutorPage
│
└── components/
    ├── Header
    ├── Sidebar
    ├── Camera
    ├── SkeletonCanvas
    ├── LessonPanel
    ├── FeedbackPanel
    └── DebugPanel
```

Each component is responsible for a single feature, making the project modular and easy to maintain. `DashboardPage` and `TutorPage` are the two top-level pages; the rest are reusable components composed within them.

---

# 🍕 Folder Structure

```text
src/
│
├── components/
│   ├── Camera/
│   ├── DebugPanel/
│   ├── FeedbackPanel/
│   ├── Header/
│   ├── LessonPanel/
│   ├── Sidebar/
│   └── SkeletonCanvas/
│
├── pages/
│   ├── DashboardPage/
│   └── TutorPage/
│
├── services/
│   ├── HandTrackingService.ts
│   ├── LandmarkProcessor.ts
│   ├── SignClassifierService.ts
│   ├── PoseAnalysisService.ts
│   ├── ProgressService.ts
│   ├── LessonEngine.ts
│   ├── LLMFeedbackService.ts
│   └── mediaDevicesService.ts
│
├── hooks/
│   ├── useAccuracyThreshold.ts
│   ├── useCamera.ts
│   ├── useHandTracking.ts
│   ├── useLessonEngine.ts
│   ├── usePoseFeedback.ts
│   ├── useProgressTracking.ts
│   └── useSignClassifier.ts
│
├── models/                    (TypeScript types/data, not the ML model files)
│   ├── aslAlphabetReference.ts
│   ├── camera.ts
│   ├── handTracking.ts
│   ├── landmarkProcessing.ts
│   ├── lesson.ts
│   ├── lessonEngine.ts
│   ├── poseAnalysis.ts
│   ├── progress.ts
│   └── spellingWordList.ts
│
└── utils/
    ├── classNames.ts
    ├── handGeometry.ts
    └── templateFeedback.ts

public/
└── models/
    └── asl-classifier/        (the actual exported TF.js classifier — see below)
        ├── model.json
        ├── group1-shard1of1.bin
        └── labels.json
```

**Note on the two "models" folders:** `src/models/` holds ordinary TypeScript type definitions and static data (word lists, reference tables) — it is not where the trained classifier lives. The actual exported ASL classifier files live in `public/models/asl-classifier/`, served as static assets and loaded at runtime by `SignClassifierService.ts`. The offline Python pipeline that produced those three files (landmark extraction → training → export) is not included in this project bundle — see `TechnicalReport.md`'s training-pipeline note for details.

---

# 🍕 Data Flow

```text
Webcam

↓

MediaPipe Hands

↓

21 Landmarks

↓

Normalization

↓

MLP Classifier

↓

Letter Prediction

↓

Pose Analysis

↓

Feedback Engine (template-based, or LLM-rephrased when WebGPU is available)

↓

React UI
```

---

# 🍕 On-Device AI Pipeline

The application uses **three** AI models, all running entirely within the browser.

## 1. MediaPipe Hands

Purpose

- Hand detection
- Landmark estimation

Output

21 hand landmarks

## 2. Custom Gesture Classifier

Purpose

Recognize ASL alphabet gestures.

Input

63 normalized values

Output

24 alphabet classes (A–Y, excluding J and Z)

## 3. On-device LLM (feedback phrasing)

Purpose

Rewrite the deterministic pose-analysis feedback into more natural, encouraging tutor-style language.

Technology

WebLLM (`@mlc-ai/web-llm`) running via WebGPU, using a small instruction-tuned model (Qwen2.5-0.5B-Instruct or a listed fallback — see `TechnicalReport.md` §9.1 for the full candidate list).

Fallback

If WebGPU isn't available, or the model fails to load, feedback falls back to plain string templates (`utils/templateFeedback.ts`) rather than failing outright.

---

# 🍕 Performance Considerations

The system is optimized for real-time execution.

Key design choices include:

- Lightweight neural network (~18.6K parameters, ~25 KB on disk — see `TechnicalReport.md` §1–§3)
- Small feature vector (63 values)
- Browser-native inference
- No network latency for the classifier or hand-tracking steps, once their one-time assets are cached
- Efficient React rendering

Actual measured latency, memory, and device-testing gaps are tracked in detail in `TechnicalReport.md` — this document only covers the design intent, not measured numbers.

---

# 🍕 Privacy & Security

Privacy is central to the system architecture.

The application never:

- Uploads camera frames
- Sends user gestures to a server
- Uses external inference APIs
- Stores personal information remotely

All computation is performed locally on the user's device. See `local-ai-verification.md` for the detailed, source-level audit backing this claim, and `TechnicalReport.md` §8 for the fuller privacy/permissions/storage writeup.

---

# 🍕 Future Architecture

The current architecture is modular, allowing additional features without major structural changes.

Potential extensions include:

- Continuous word recognition
- Adaptive lesson engine
- Gamification
- Offline sign dictionary
- Sign-to-text mode
- Voice-guided lessons
- Mobile deployment using TensorFlow Lite
- Restoring the offline training pipeline (landmark extraction, training, export scripts) to this project bundle for full reproducibility of the shipped classifier

---

# 🍕 Summary

SignSense AI follows a modular, offline-first architecture where every stage of the AI pipeline — from hand detection to gesture recognition to feedback phrasing — runs entirely within the browser.

This design provides a responsive user experience while preserving privacy, making it well suited for educational applications that require real-time interaction without cloud dependency.
