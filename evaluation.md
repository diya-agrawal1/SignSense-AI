# Evaluation

## 1. Headline results

| Metric | Value |
|---|---|
| Test accuracy | **98.78%** |
| Test loss | 0.0629 |
| Classes | 24 (A–Y, excluding J and Z) |
| Test set size | 8,306 samples |
| Macro/weighted-average precision, recall, F1 | 0.99 / 0.99 / 0.99 |

Per-class detail (precision / recall / F1 / support):

| Letter | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| A | 0.99 | 1.00 | 0.99 | 327 |
| B | 1.00 | 1.00 | 1.00 | 331 |
| C | 0.99 | 0.99 | 0.99 | 294 |
| D | 0.99 | 1.00 | 0.99 | 369 |
| E | 0.99 | 0.99 | 0.99 | 346 |
| F | 0.99 | 0.99 | 0.99 | 430 |
| G | 0.99 | 1.00 | 1.00 | 364 |
| H | 0.99 | 0.98 | 0.99 | 356 |
| I | 0.99 | 0.96 | 0.98 | 357 |
| K | 0.99 | 1.00 | 0.99 | 405 |
| L | 1.00 | 0.99 | 1.00 | 378 |
| M | **0.94** | 0.98 | 0.96 | 240 |
| N | 0.97 | **0.94** | 0.95 | 191 |
| O | 0.97 | 0.99 | 0.98 | 357 |
| P | 0.99 | 0.99 | 0.99 | 306 |
| Q | 0.98 | 1.00 | 0.99 | 317 |
| R | 0.98 | 0.99 | 0.98 | 382 |
| S | 0.98 | 0.99 | 0.99 | 384 |
| T | 0.99 | 0.99 | 0.99 | 353 |
| U | 0.98 | 0.98 | 0.98 | 377 |
| V | 0.99 | 0.99 | 0.99 | 382 |
| W | 0.99 | 0.98 | 0.99 | 368 |
| X | 0.98 | 0.98 | 0.98 | 323 |
| Y | 0.99 | 0.99 | 0.99 | 387 |

## 2. Benchmark method

- **Data source:** 55,368 landmark feature vectors, extracted by `ml/extract_landmarks.py` (MediaPipe `HandLandmarker` Tasks API) from the [Kaggle ASL Alphabet dataset](https://www.kaggle.com/datasets/grassknoted/asl-alphabet) (87,000 source images; the gap is images where no hand was detected).
- **Split:** stratified 70/15/15 train/val/test via `sklearn.model_selection.train_test_split`, fixed `random_state=42` (reproducible).
- **Held-out discipline:** validation accuracy (not test accuracy) drove early stopping and the LR schedule — the test set was touched exactly once, after training finished. This is what makes 98.78% a genuine generalization number, not an implicitly-tuned one.
- **Metrics:** `sklearn.metrics.classification_report` and a confusion matrix (`ConfusionMatrixDisplay`, saved as `confusion_matrix.png`) — standard multi-class evaluation.
- **Ground truth:** the Kaggle dataset's own folder-name labels, not independently re-verified by a human rater — any source-dataset mislabeling carries through uncaught.

## 3. Baseline comparison

Computed directly from this evaluation's own test-set class distribution:

| Baseline | Accuracy | How it's computed |
|---|---|---|
| Random guess | 4.17% | 1 / 24 classes |
| Majority-class ("always predict F") | 5.18% | 430 (F's test-set support) / 8,306 (total test-set size)¹ |

¹ *Summing the individual per-letter support values in §9.1 gives 8,324, not 8,306 — a small discrepancy from transcribing the original training output; 8,306 is used since it's the total stated directly in the report's own accuracy row. Either way, the majority-class baseline lands at ~5%.*

The model's 98.78% is **~19x the majority-class baseline** — large enough to be confident it's learning real hand-shape structure, not exploiting class imbalance. What's still missing: no comparison against another real hand-landmark ASL classifier (published or otherwise) — the trivial baselines confirm the model isn't degenerate, but don't establish how it stacks up against a CNN-on-raw-pixels approach or a published benchmark.

## 4. Known failure cases

- **M and N are the weakest classes** (M: 0.94 precision, N: 0.94 recall) — not random noise: M and N are visually similar closed-fist handshapes in ASL, a documented source of confusion in ASL instruction generally.
- **J and Z are not supported at all**, by design: both require motion, which a single static frame can't capture. Input resembling either gets forced into one of the 24 known classes, incorrectly.
- **Real-world (live webcam) failure modes are not yet characterized.** Every number above comes from the Kaggle dataset's held-out test images — a fairly consistent image style. Live webcam input introduces variables the test set doesn't cover: real lighting, backgrounds, camera quality, distance, and skin tones/hand sizes not necessarily well-represented if the source dataset's demographic diversity is narrow (not independently audited).
- **Single-hand assumption:** `maxNumHands: 1` — a second hand in frame (support hand, background person) is simply ignored, not formally evaluated.
- **No systematic confusion-matrix deep dive beyond M/N** — `confusion_matrix.png` exists but a full off-diagonal read (which letters get confused with which, beyond the two flagged above) hasn't been written up.

## 5. What this evaluation does not cover

- **`PoseAnalysisService.ts`'s per-finger correctness feedback** — a separate, rule-based component with its own accuracy characteristics, never benchmarked here.
- **`LessonEngine.ts`'s letter-selection quality** — a UX/pedagogy question needing real user-study data, not a held-out test set.
- **`LLMFeedbackService.ts`'s phrasing quality** — whether generated sentences are clear and don't hallucinate beyond the input JSON; worth a dedicated qualitative review, not done here.

---
