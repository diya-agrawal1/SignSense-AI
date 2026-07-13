import type { PoseAnalysisResult } from "../models/poseAnalysis";

// WebLLM is only imported dynamically (see loadEngineModule below) so that
// its ~fairly large runtime is never pulled into the initial bundle, and so
// this file doesn't hard-fail to import in environments without WebGPU.
type WebLLMModule = typeof import("@mlc-ai/web-llm");
type MLCEngine = import("@mlc-ai/web-llm").MLCEngineInterface;
export type InitProgressCallback = import("@mlc-ai/web-llm").InitProgressCallback;

const SYSTEM_PROMPT = `You are a supportive ASL (American Sign Language) tutor giving quick, 
encouraging feedback to a student practicing hand signs.

You will receive a JSON object describing the student's current attempt. 
It contains:
- The target letter they are trying to sign
- Per-finger status: "correct" or "incorrect" (with an issue type and 
  angle difference if incorrect)
- Palm orientation status

STRICT RULES:
1. Only mention findings that are explicitly present in the JSON. 
   Never invent, assume, or add any issue not listed.
2. If a finger or the palm has status "correct", do not mention it 
   unless ALL fingers and palm are correct (in which case, give a 
   short positive confirmation).
3. If there are multiple incorrect fingers, prioritize mentioning at 
   most the top 1-2 issues by angleDiff (largest difference first) — 
   do not list every single one if there are many.
4. Keep the response to 1-2 short sentences. No preamble, no repeating 
   the JSON back, no markdown, no emojis.
5. Tone: encouraging and simple, like a patient teacher. Avoid technical 
   terms like "angleDiff" or "status" in your output — translate them 
   into plain instructions (e.g. "curl your index finger a bit more" 
   instead of "index angleDiff 22").
6. If the JSON shows everything correct, respond with a short 
   celebratory confirmation (e.g. "Nice! That's a clean A.").
7. Never mention that you are an AI, a model, or that you are 
   "generating" feedback. Just give the feedback directly, as a tutor would.

Respond with plain text only — the feedback sentence(s), nothing else.`;

/**
 * Preferred model candidates, smallest/cheapest first. We only ever need
 * this model to rephrase a small JSON blob into a sentence, so we deliberately
 * reach for the lightest instruct model available rather than anything
 * general-purpose-capable. Verify these IDs still exist in the installed
 * @mlc-ai/web-llm version's `prebuiltAppConfig.model_list` — MLC renames/
 * retires quantization variants across releases.
 */
const MODEL_CANDIDATES = [
  "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2-0.5B-Instruct-q4f16_1-MLC",
  "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
];

const INFERENCE_TIMEOUT_MS = 6000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

/**
 * LLMFeedbackService
 *
 * Part B of the Stage 6 hybrid tutor: takes Part A's structured JSON
 * (PoseAnalysisResult) and rephrases it into a short, encouraging sentence
 * using a small on-device LLM via WebLLM (WebGPU). Never computes findings
 * itself — it only phrases what PoseAnalysisService already determined.
 *
 * Lazy by design: the model is not downloaded/loaded until preload() (or
 * the first generateFeedback() call) actually happens, so app boot stays
 * fast. WebLLM caches the compiled model in the browser after first load.
 */
export class LLMFeedbackService {
  private enginePromise: Promise<MLCEngine> | null = null;
  private modelId: string | null = null;

  /** True when the browser can plausibly run WebGPU-accelerated inference at all. */
  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  /**
   * Kicks off model loading without blocking on a prediction. Safe to call
   * multiple times — subsequent calls reuse the in-flight/loaded engine.
   * Call this when tutor/practice mode starts, not on app boot.
   */
  async preload(onProgress?: InitProgressCallback): Promise<void> {
    await this.getEngine(onProgress);
  }

  /**
   * Rephrases a Part A result into a short feedback sentence. Throws if
   * WebGPU is unavailable, the model fails to load, or inference times
   * out — callers should catch this and fall back to
   * generateTemplateFeedback() from utils/templateFeedback.ts.
   */
  async generateFeedback(result: PoseAnalysisResult): Promise<string> {
    const engine = await withTimeout(this.getEngine(), INFERENCE_TIMEOUT_MS, "WebLLM model load");

    const response = await withTimeout(
      engine.chat.completions.create({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(serializeForModel(result)) },
        ],
        temperature: 0.4,
        max_tokens: 80,
      }),
      INFERENCE_TIMEOUT_MS,
      "WebLLM inference"
    );

    const text = response.choices[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("WebLLM returned an empty response.");
    }
    return text;
  }

  /** The model id actually selected from MODEL_CANDIDATES, once known — useful for a debug/about display. */
  get currentModelId(): string | null {
    return this.modelId;
  }

  /** Releases the loaded model. Call on unmount if you create a new instance per component lifecycle. */
  async dispose(): Promise<void> {
    const engine = await this.enginePromise?.catch(() => null);
    await engine?.unload();
    this.enginePromise = null;
  }

  private getEngine(onProgress?: InitProgressCallback): Promise<MLCEngine> {
    if (!LLMFeedbackService.isSupported()) {
      return Promise.reject(new Error("WebGPU is not available in this browser."));
    }

    if (!this.enginePromise) {
      this.enginePromise = this.createEngine(onProgress);
    }
    return this.enginePromise;
  }

  private async createEngine(onProgress?: InitProgressCallback): Promise<MLCEngine> {
    const webllm: WebLLMModule = await import("@mlc-ai/web-llm");

    const availableIds = new Set(webllm.prebuiltAppConfig.model_list.map((m: { model_id: string }) => m.model_id));
    const modelId = MODEL_CANDIDATES.find((id) => availableIds.has(id));
    if (!modelId) {
      throw new Error(
        "None of the configured MODEL_CANDIDATES exist in this @mlc-ai/web-llm version's prebuiltAppConfig.model_list. Update MODEL_CANDIDATES."
      );
    }
    this.modelId = modelId;

    return webllm.CreateMLCEngine(modelId, {
      initProgressCallback: onProgress,
    });
  }
}

/** Strips the result down to just what the system prompt's rules reference, keeping the payload small. */
function serializeForModel(result: PoseAnalysisResult) {
  return {
    letter: result.letter,
    fingers: Object.fromEntries(
      Object.entries(result.fingers).map(([name, f]) => [
        name,
        f.status === "correct" ? { status: "correct" } : { status: "incorrect", issue: f.issue, angleDiff: f.angleDiff },
      ])
    ),
    palm: result.palm.status === "not_checked" ? undefined : { status: result.palm.status, issue: result.palm.issue },
  };
}
