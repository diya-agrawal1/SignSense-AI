# 🏗️ SignSense AI – Architecture

This document describes the technical architecture of **SignSense AI**, an offline AI-powered tutor for learning American Sign Language (ASL) fingerspelling.

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
                     │
                     ▼
               React User Interface
```

---

# 🍕 Architecture Overview

The application is built around an **entirely client-side pipeline**. Every stage—from image acquisition to gesture recognition—runs locally inside the browser.

There are **no backend APIs**, **no cloud inference**, and **no video uploads**.

This architecture provides:

- Low latency
- Offline functionality
- Privacy-preserving inference
- Cross-platform browser compatibility

---

# 🍕 Component Breakdown

## 1. Camera Module

**Technology**

- Browser `getUserMedia()` API

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

MediaPipe Hands

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

Before inference, they are normalized.

### Processing Steps

- Wrist-centered translation
- Scale normalization
- Feature vector generation

Output:

```text
63 Features

21 × (x, y, z)
```

These normalized values become the input for the classifier.

---

## 4. Gesture Classification

This is the project's primary AI model.

### Model

Lightweight Multi-Layer Perceptron (MLP)

### Input

63 normalized landmark values

### Output

- Predicted ASL Letter
- Confidence Score

Example

```text
Prediction

Letter : G

Confidence : 97%
```

The model executes locally using TensorFlow.js.

---

## 5. Pose Analysis

The predicted letter alone is not enough for learning.

The pose analysis engine compares the detected hand pose against the expected pose for the target letter.

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

The feedback engine converts pose analysis into learner-friendly suggestions.

Responsibilities include:

- Display detected letter
- Show confidence score
- Highlight incorrect fingers
- Generate corrective hints

This component acts as the tutoring layer of the application.

---

## 7. Progress Tracking

User progress is stored locally using browser storage.

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

├── Header
├── Sidebar
├── Dashboard
├── Camera
├── SkeletonCanvas
├── LessonPanel
└── FeedbackPanel
```

Each component is responsible for a single feature, making the project modular and easy to maintain.

---

# 🍕 Folder Structure

```text
src/

components/
│
├── Camera/
├── Dashboard/
├── FeedbackPanel/
├── Header/
├── LessonPanel/
├── Sidebar/
└── SkeletonCanvas/

services/
│
├── HandTrackingService.ts
├── LandmarkProcessor.ts
├── ClassifierService.ts
├── PoseAnalysisService.ts
├── ProgressService.ts
└── LessonEngine.ts

models/
└── gesture_model/

hooks/

pages/

utils/
```

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

Feedback Engine

↓

React UI
```

---

# 🍕 On-Device AI Pipeline

The application uses two AI models.

## MediaPipe Hands

Purpose

- Hand detection
- Landmark estimation

Output

21 hand landmarks

---

## Custom Gesture Classifier

Purpose

Recognize ASL alphabet gestures.

Input

63 normalized values

Output

26 alphabet classes

Both models execute entirely within the browser.

---

# 🍕 Performance Considerations

The system is optimized for real-time execution.

Key design choices include:

- Lightweight neural network
- Small feature vector (63 values)
- Browser-native inference
- No network latency
- Efficient React rendering

---

# 🍕 Privacy & Security

Privacy is central to the system architecture.

The application never:

- Uploads camera frames
- Sends user gestures to a server
- Uses external inference APIs
- Stores personal information remotely

All computation is performed locally on the user's device.

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

---

# 🍕 Summary

SignSense AI follows a modular, offline-first architecture where every stage of the AI pipeline—from hand detection to gesture recognition and feedback—runs entirely within the browser.

This design provides a responsive user experience while preserving privacy, making it well suited for educational applications that require real-time interaction without cloud dependency.
