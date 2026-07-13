# 🤟 SignSense AI

> An offline AI tutor that helps users learn ASL fingerspelling through real-time recognition and corrective feedback.

Most people learning sign language rely on static images or videos and have no reliable way to check whether they're forming signs correctly. Existing AI-powered solutions often depend on cloud processing, raising privacy concerns and requiring a stable internet connection.

**SignSense AI** provides a privacy-friendly alternative. Using only a device's camera, it recognizes ASL fingerspelling in real time, analyzes hand posture, and provides instant feedback—all entirely on-device, with no video ever leaving the user's browser.

## 🎥 Demo

<p align="center">
  <img src="demo.gif" alt="SignSense AI Demo" width="800"/>
</p>

---

## ✨ Features

* Real-time ASL fingerspelling recognition
* On-device hand tracking using MediaPipe Hands
* Lightweight local AI classifier
* Instant corrective feedback for incorrect hand poses
* Hand skeleton visualization
* Confidence-based predictions
* Fully offline inference
* Privacy-first design with no cloud processing

---

## 🧠 How It Works

The application processes webcam input locally and converts hand movements into sign predictions.

```text
Camera Feed
      ↓
MediaPipe Hands
      ↓
21 Hand Landmarks
      ↓
Landmark Normalization
      ↓
Local AI Classifier
      ↓
Predicted Letter
      ↓
Pose Analysis
      ↓
Real-Time Feedback
```

### Hand Tracking

SignSense AI uses **MediaPipe Hands** to detect and track 21 hand landmarks in real time. These landmarks represent key joints and fingertip positions, providing a compact representation of the user's hand pose.

### Letter Recognition

The landmark coordinates are normalized and passed into a lightweight neural network running directly in the browser. The model predicts the most likely ASL letter and returns a confidence score.

### Pose Analysis

Beyond classification, the system analyzes finger positions, joint angles, and overall hand orientation to identify mistakes in the user's pose. This allows the application to provide meaningful feedback instead of simply marking a sign as incorrect.

---

## 🔒 Privacy & On-Device AI

Every part of the recognition pipeline runs locally on the user's device.

* No video uploads
* No cloud inference
* No external processing
* No internet connection required after loading the application

This ensures low latency, improved privacy, and uninterrupted usage.

---

## 🛠️ Tech Stack

| Category         | Technology              |
| ---------------- | ----------------------- |
| Frontend         | React, Vite, TypeScript |
| Computer Vision  | MediaPipe Hands         |
| Machine Learning | TensorFlow.js           |
| Visualization    | HTML5 Canvas            |
| Storage          | LocalStorage            |
| Deployment       | Vercel / Netlify        |

---

## 🚀 Future Improvements

* Adaptive learning based on user performance
* Continuous word recognition
* Progress tracking and analytics
* Gamified learning challenges
* Support for additional sign language datasets
* Personalized lesson generation

---

## 👥 Team

Built for the **On-Device AI** track with a focus on accessibility, privacy, and real-time learning.

If you're reading this and know sign language better than we do, we'd love your feedback 
