import * as tf from "@tensorflow/tfjs";
import type { FeatureVector } from "../models/landmarkProcessing";

export interface ClassificationResult {
  letter: string;
  /** Softmax confidence for the top prediction, 0..1. */
  confidence: number;
}

const MODEL_URL = "/models/asl-classifier/model.json";
const LABELS_URL = "/models/asl-classifier/labels.json";

/**
 * SignClassifierService
 *
 * Loads the TF.js ASL alphabet model (trained offline — see
 * ml/train_model.py) and classifies normalized 63-value feature vectors
 * produced by LandmarkProcessor. Runs entirely in-browser via WebGL/WASM,
 * no network calls after the initial model download.
 *
 * The model expects input already normalized exactly like
 * LandmarkProcessor.process() does — it was trained on vectors produced
 * by the Python port of that same pipeline. Feed it anything else and
 * predictions will be meaningless.
 */
export class SignClassifierService {
  private modelPromise: Promise<tf.GraphModel>;
  private labelsPromise: Promise<string[]>;

  constructor(modelUrl: string = MODEL_URL, labelsUrl: string = LABELS_URL) {
    this.modelPromise = tf.loadGraphModel(modelUrl);
    this.labelsPromise = fetch(labelsUrl).then((res) => {
      if (!res.ok) {
        throw new Error(`Failed to load labels from ${labelsUrl}: ${res.status}`);
      }
      return res.json() as Promise<string[]>;
    });
  }

  /** Triggers model + labels loading without waiting for a prediction. Call early (e.g. on mount) to avoid a delay on the first real prediction. */
  async warmUp(): Promise<void> {
    await Promise.all([this.modelPromise, this.labelsPromise]);
  }

  /** Classifies a single 63-value feature vector, returning the top predicted letter and its confidence. */
  async predict(features: FeatureVector): Promise<ClassificationResult> {
    const [model, labels] = await Promise.all([this.modelPromise, this.labelsPromise]);

    const probabilities = tf.tidy(() => {
      const input = tf.tensor2d([features], [1, features.length]);
      const output = model.predict(input);

      let outputTensor: tf.Tensor;
      if (Array.isArray(output)) {
        outputTensor = output[0];
      } else if (output instanceof tf.Tensor) {
        outputTensor = output;
      } else {
        // NamedTensorMap — a SavedModel with a single named output.
        outputTensor = Object.values(output)[0];
      }

      return outputTensor.dataSync();
    });

    let bestIndex = 0;
    for (let i = 1; i < probabilities.length; i++) {
      if (probabilities[i] > probabilities[bestIndex]) bestIndex = i;
    }

    return {
      letter: labels[bestIndex],
      confidence: probabilities[bestIndex],
    };
  }

  /** Releases the loaded model from GPU/WASM memory. Call on unmount if you create a new instance per component lifecycle. */
  async dispose(): Promise<void> {
    const model = await this.modelPromise.catch(() => null);
    model?.dispose();
  }
}
