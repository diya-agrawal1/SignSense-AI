# SignSense AI 🤟

**An Offline AI Sign Language Tutor**

SignSense AI is a privacy-first web application that helps users learn American Sign Language (ASL) fingerspelling through real-time hand recognition and instant feedback. The entire application is designed to run **completely on-device**, ensuring that no camera frames or personal data leave the user's device.

> **Current Development Status:** Stage 2 Complete (Project Setup + Camera Integration)

---

## 📌 Project Vision

Learning sign language often relies on static images or prerecorded videos, making it difficult for learners to know whether they are performing signs correctly.

SignSense AI aims to solve this by providing:

* Real-time sign recognition
* Instant corrective feedback
* Personalized practice sessions
* 100% offline processing for privacy

---

## 🚀 Current Features

### ✅ Project Setup

* React + Vite + TypeScript
* Modular project architecture
* Reusable component structure
* Ready for AI integration

### ✅ Camera Module

* Live webcam access using `getUserMedia()`
* Permission handling
* Loading and error states
* Responsive camera component
* Foundation for real-time hand tracking

---

## 🛠 Tech Stack

### Frontend

* React
* Vite
* TypeScript

### Browser APIs

* `getUserMedia()`

### Planned AI Stack

* MediaPipe Hands
* TensorFlow.js
* HTML5 Canvas
* LocalStorage

---

## 📁 Project Structure

```text
src/
│
├── components/
│   ├── Camera/
│   ├── Header/
│   ├── Sidebar/
│   ├── LessonPanel/
│   ├── FeedbackPanel/
│   └── SkeletonCanvas/
│
├── hooks/
│
├── models/
│
├── pages/
│
├── services/
│
├── utils/
│
└── App.tsx
```

---

## ⚙️ Getting Started

### Clone the repository

```bash
git clone <repository-url>
cd signsense-ai
```

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Open your browser and navigate to:

```
http://localhost:5173
```

Allow camera permissions when prompted.

---

## 🗺 Development Roadmap

### ✅ Stage 1 — Project Setup

* [x] React + Vite + TypeScript
* [x] Folder architecture
* [x] Reusable component structure

### ✅ Stage 2 — Camera Integration

* [x] Webcam access
* [x] Permission handling
* [x] Responsive camera view
* [x] Error handling

### ⏳ Upcoming Stages

* [ ] MediaPipe Hands integration
* [ ] Hand landmark extraction
* [ ] Landmark normalization
* [ ] ASL letter classification
* [ ] Pose analysis
* [ ] Finger-level corrective feedback
* [ ] Skeleton overlay visualization
* [ ] Progress tracking
* [ ] Adaptive learning engine
* [ ] Continuous fingerspelling recognition

---

## 🎯 Long-Term Goal

SignSense AI will become a fully offline AI-powered sign language tutor capable of:

* Detecting ASL fingerspelling in real time
* Providing explainable finger-level feedback
* Tracking user progress locally
* Generating adaptive practice sessions
* Preserving user privacy by keeping all inference on-device

---

## 🔒 Privacy First

SignSense AI is designed with privacy as a core principle.

* Camera frames are processed locally.
* No video is uploaded to any server.
* No cloud-based inference.
* No personal data leaves the user's device.

---

## 👥 Team

Developed as a hackathon project focused on building an intelligent, privacy-preserving, on-device AI learning experience for sign language education.
