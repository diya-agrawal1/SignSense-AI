# 🍕 SignSense AI

<p align="center">
  <h3 align="center">An Offline AI Tutor for Learning ASL Fingerspelling</h3>
  <p align="center">
    Privacy First • On-Device AI • React • TensorFlow.js • MediaPipe
  </p>
</p>

---

## 🍕 Overview

SignSense AI is a browser-based application that helps users learn **American Sign Language (ASL) fingerspelling** through real-time recognition and intelligent visual feedback.

Unlike conventional sign language learning resources that rely on static images or cloud-based processing, SignSense AI performs the complete recognition pipeline **entirely on-device**. This enables low-latency predictions, offline accessibility (after first load), and complete privacy, as no camera frames are transmitted outside the user's device.

The application combines **MediaPipe Hands** for real-time hand landmark detection, a **custom-trained lightweight MLP classifier** for ASL alphabet recognition, and an optional **on-device LLM** (via WebLLM/WebGPU) that rephrases feedback into more natural, encouraging tutor language.

---

## 🍕 Problem Statement

Learning ASL fingerspelling without an instructor is challenging because learners rarely receive immediate feedback on hand posture. Existing AI-powered solutions frequently rely on cloud inference, introducing privacy concerns and limiting usability in low-connectivity environments.

SignSense AI addresses these challenges by providing a fully offline learning assistant capable of:

- Detecting hand landmarks in real time
- Recognizing ASL alphabet gestures
- Providing pose-aware corrective feedback
- Tracking learning progress locally
- Running entirely on-device

---

## 🍕 Features

- 📷 Real-time webcam integration
- ✋ Live hand tracking using MediaPipe Hands
- 🧠 Custom-trained ASL gesture classifier
- 🎯 Recognition of ASL fingerspelling (A–Y, excluding J and Z — both require motion a single frame can't capture)
- 💬 Optional on-device LLM feedback phrasing (WebLLM/WebGPU), with a template-based fallback when unavailable
- 💡 Finger-level corrective feedback
- 📈 Prediction confidence score
- 🦴 Live hand skeleton visualization
- 📊 Local progress tracking
- 🔒 Complete on-device inference
- 🌐 Offline-capable after first load

---

## 🍕 System Architecture

```text
                 Webcam
                    │
                    ▼
            MediaPipe Hands
        (21 Hand Landmarks)
                    │
                    ▼
        Landmark Normalization
                    │
                    ▼
     Custom MLP Gesture Classifier
                    │
                    ▼
      Predicted Letter + Confidence
             │                │
             ▼                ▼
      Pose Analysis     Progress Tracker
             │
             ▼
      Feedback Generation
   (template, or on-device LLM rephrasing)
             │
             ▼
      Interactive Learning UI
```

See `architecture.md` for a full component-by-component breakdown.

---

## 🍕 AI Models

### MediaPipe Hands

Responsible for:

- Hand detection
- 21-point landmark extraction
- Real-time hand tracking

Runs locally inside the browser using WebAssembly/WebGL.

### Custom Gesture Classifier

A lightweight **Multi-Layer Perceptron (MLP)** trained on normalized hand landmarks.

| Property | Value |
|----------|-------|
| Input | 63 normalized values (21 × x, y, z) |
| Output | 24 ASL alphabet classes (A–Y, excluding J and Z) |
| Framework | TensorFlow.js |
| Execution | Browser (On-Device) |


## 🍕 Model Performance

| Metric | Value |
|--------|------:|
| Architecture | Multi-Layer Perceptron (MLP) |
| Input Features | 63 |
| Output Classes | 24 |
| Model Size | ~25 KB (quantized) |
| Test-set accuracy | 98.78%  |
| Runtime | TensorFlow.js |
| Execution | Browser (CPU/GPU via WebGL/WASM) |


### Performance Highlights

- ⚡ Lightweight browser inference (~25 KB model)
- ⚡ Low-latency predictions (hand detection is the bottleneck, not classification — see `TechnicalReport.md` §4)
- 🔒 No cloud processing
- 📷 Camera frames never leave the device
- 🌐 Works offline after the two one-time asset downloads 

---

## 🍕 Tech Stack

| Category | Technology |
|----------|------------|
| Frontend | React + Vite + TypeScript |
| Hand tracking | MediaPipe Hands |
| Classifier | Custom MLP, TensorFlow.js |
| Feedback LLM | WebLLM (`@mlc-ai/web-llm`) over WebGPU |
| Visualization | HTML5 Canvas |
| Browser APIs | `getUserMedia`, WebGPU, `localStorage` |
| Storage | `localStorage` |
| Deployment | GitHub Pages / Vercel (any static host — no backend required) |

---

## 🍕 Project Structure

```text
src/
│
├── components/
├── hooks/
├── models/        (TypeScript types/data — NOT the trained ML model, see below)
├── pages/
├── services/
├── utils/
└── App.tsx

public/
└── models/
    └── asl-classifier/   (the actual trained, exported classifier files)
```

See `architecture.md` for the full folder tree with every file listed.

---

## 🍕 Installation

### Clone the repository

```bash
git clone https://github.com/<your-username>/signsense-ai.git
cd signsense-ai
```

### Install dependencies

```bash
npm install
```

### Run locally

```bash
npm run dev
```

### Production build

```bash
npm run build
npm run preview
```

---

## 🍕 Usage

1. Launch the application.
2. Allow webcam permissions.
3. Position your hand inside the frame.
4. Follow the prompted ASL letter.
5. View:
   - Predicted letter
   - Confidence score
   - Skeleton overlay
   - Corrective feedback
6. Continue practicing while progress is stored locally.

---

## 🍕 Sample Input

```text
Prompt:
Sign the letter G
```

### Expected Output

```text
Detected Letter : G

Confidence : 97%

✓ Thumb position correct
✓ Middle finger correct
✗ Index finger slightly bent

Suggestion:
Straighten your index finger slightly.
```

---

## 🍕 Deployment

The application can be deployed on **GitHub Pages** or **Vercel** since all inference is performed client-side — no backend or server-side model hosting is required.

### GitHub Pages

```bash
npm run build
npm run deploy
```

Repository:

```
https://github.com/<your-username>/signsense-ai
```

---

## 🍕 Privacy

Privacy is a core design principle.

- No cloud inference
- No video uploads
- No external AI APIs
- Local-only processing
- Progress stored on the user's device


---

## 🍕 Future Work

- Continuous word recognition
- Adaptive lesson generation
- Gamified practice mode
- Daily streaks
- Sign-to-text mode
- Expanded sign dictionary
- Mobile optimization
- Restoring the offline training pipeline to this repository for full reproducibility

---

## 🍕 Team

Built as a hackathon project exploring **On-Device AI** through computer vision, lightweight machine learning, and interactive education by Diya Agrawal, Pavani Agarwal, Swasti Garg.

---

## 🍕 License

This project is licensed under the **MIT License**.

---

<p align="center">
Made with ❤️, ☕ and 🍕
</p>
