import { useEffect, useRef } from "react";
import { HAND_CONNECTIONS } from "../../models/handTracking";
import type { HandLandmarks, NormalizedLandmark } from "../../models/handTracking";
import type { ExtensionState, FingerName, PoseAnalysisResult } from "../../models/poseAnalysis";
import { FINGER_JOINT_INDICES, FINGER_NAMES } from "../../models/poseAnalysis";
import { lerpLandmark } from "../../utils/handGeometry";
import styles from "./SkeletonCanvas.module.css";

export interface SkeletonCanvasProps {
  /** Width/height in CSS pixels the canvas should track. Usually the Camera frame's size. Omit to auto-track the container via ResizeObserver. */
  width?: number;
  height?: number;
  /** 21 hand landmarks to draw, or null when no hand is detected. */
  landmarks?: HandLandmarks | null;
  /**
   * Stage 6/7's structured pose result for the current target letter.
   * When present, live-hand connections are color-coded correct/incorrect
   * per finger and palm, and a translucent "correct hand" ghost overlay is
   * drawn showing the target shape. Omit to fall back to a neutral skeleton
   * (e.g. before a target letter is chosen).
   */
  poseAnalysis?: PoseAnalysisResult | null;
  /** Optional FPS readout drawn in the corner. Omit to hide it. */
  fps?: number;
  className?: string;
}

const LANDMARK_COLOR = "#00e5ff";
const NEUTRAL_CONNECTION_COLOR = "#ffffff";
const CORRECT_COLOR = "#5bd48f"; // matches --color-success
const INCORRECT_COLOR = "#ef5b5b"; // matches --color-danger
const GHOST_COLOR = "#f2b84b"; // matches --color-accent-amber — deliberately distinct from live-hand status colors so the ghost always reads as "target", not another correctness signal
const LANDMARK_RADIUS = 4;
const GHOST_RADIUS = 3;

/** Per-frame lerp factor pulling the displayed skeleton toward the latest raw landmarks. Keeps drawing smooth (and at display refresh rate) even though MediaPipe itself may deliver frames slower than 60fps. */
const POSITION_SMOOTHING = 0.35;
/** Per-frame lerp factor for the ghost overlay's fade in/out. */
const GHOST_FADE_SMOOTHING = 0.08;
/** How much of a full pulse cycle (incorrect-finger attention glow) completes per millisecond. */
const PULSE_RATE = 1 / 900;

/** How far each ghost joint gets pulled from its live position toward the palm centroid, before scaling by how curled the target expects it to be. TIP moves most, MCP (unlisted — stays live) doesn't move at all. */
const GHOST_PULL: Record<"pip" | "dip" | "tip", number> = { pip: 0.22, dip: 0.5, tip: 0.82 };
const CURL_RATIO: Record<ExtensionState, number> = { extended: 0, halfCurled: 0.5, curled: 1 };

/** Landmark index -> which finger it belongs to, or "palm" for the wrist and cross-palm connections. */
function fingerOfLandmark(index: number): FingerName | "palm" {
  if (index === 0) return "palm";
  if (index <= 4) return "thumb";
  if (index <= 8) return "index";
  if (index <= 12) return "middle";
  if (index <= 16) return "ring";
  return "pinky";
}

function connectionGroup(startIdx: number, endIdx: number): FingerName | "palm" {
  const a = fingerOfLandmark(startIdx);
  const b = fingerOfLandmark(endIdx);
  return a === b ? a : "palm";
}

/** Palm centroid: wrist + index/pinky MCP barely move as fingers curl, so this stays stable regardless of hand shape — same insight PoseAnalysisService's wrist-roll check relies on. */
function palmCentroid(landmarks: HandLandmarks): NormalizedLandmark {
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const pinkyMcp = landmarks[17];
  return {
    x: (wrist.x + indexMcp.x + pinkyMcp.x) / 3,
    y: (wrist.y + indexMcp.y + pinkyMcp.y) / 3,
    z: (wrist.z + indexMcp.z + pinkyMcp.z) / 3,
  };
}

/**
 * Builds a "ghost" PIP/DIP/TIP position per finger by pulling each live
 * joint toward the palm centroid, scaled by how curled the target letter
 * expects that finger to be (0 for extended, up to ~0.8x for curled).
 *
 * This is a lightweight geometric approximation, not real forward
 * kinematics — it deliberately avoids modeling a per-finger bend axis
 * (getting that sign wrong would visually bend fingers backward). Pulling
 * toward a fixed interior point is always anatomically sane in every hand
 * orientation, at the cost of not being a perfectly realistic hand pose.
 * Good enough to show "this finger should tuck in more/less" at a glance.
 */
function computeGhostFinger(
  landmarks: HandLandmarks,
  finger: FingerName,
  expected: ExtensionState,
  centroid: NormalizedLandmark
): { mcp: NormalizedLandmark; pip: NormalizedLandmark; dip: NormalizedLandmark; tip: NormalizedLandmark } {
  const [mcpIdx, pipIdx, dipIdx, tipIdx] = FINGER_JOINT_INDICES[finger];
  const ratio = CURL_RATIO[expected];
  return {
    mcp: landmarks[mcpIdx], // MCP stays put — matches PoseAnalysisService's own assumption that it barely moves
    pip: lerpLandmark(landmarks[pipIdx], centroid, GHOST_PULL.pip * ratio),
    dip: lerpLandmark(landmarks[dipIdx], centroid, GHOST_PULL.dip * ratio),
    tip: lerpLandmark(landmarks[tipIdx], centroid, GHOST_PULL.tip * ratio),
  };
}

/**
 * Transparent overlay canvas that sits on top of the Camera preview.
 *
 * Runs its own requestAnimationFrame loop (independent of how often new
 * `landmarks` actually arrive from MediaPipe) so drawing stays smooth at
 * display refresh rate: positions ease toward the latest data rather than
 * snapping, and the ghost overlay/incorrect-finger highlight fade and pulse
 * continuously. When `poseAnalysis` is provided, live-hand connections are
 * color-coded correct/incorrect per finger and palm, and a translucent
 * "correct hand" ghost is drawn for the current target letter.
 *
 * Drawing coordinates are mirrored to match the Camera video, which is
 * mirrored via CSS (`transform: scaleX(-1)` in Camera.module.css) —
 * mirroring here in canvas-space keeps that CSS untouched.
 */
export function SkeletonCanvas({ width, height, landmarks, poseAnalysis, fps, className }: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  // Latest raw inputs, read fresh by the rAF loop each tick without
  // re-subscribing the loop itself.
  const landmarksRef = useRef<HandLandmarks | null | undefined>(landmarks);
  const poseAnalysisRef = useRef<PoseAnalysisResult | null | undefined>(poseAnalysis);
  const fpsRef = useRef<number | undefined>(fps);
  landmarksRef.current = landmarks;
  poseAnalysisRef.current = poseAnalysis;
  fpsRef.current = fps;

  // Smoothed/animated drawing state, persisted across frames.
  const displayedRef = useRef<HandLandmarks | null>(null);
  const ghostOpacityRef = useRef(0);
  const pulsePhaseRef = useRef(0);

  // Keep the backing store sized (and DPR-scaled) to the container. Uses
  // ResizeObserver so it stays correct across responsive breakpoints, not
  // just at mount.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const applySize = (cssWidth: number, cssHeight: number) => {
      const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width: cssWidth, height: cssHeight };
      canvas.width = cssWidth * dpr;
      canvas.height = cssHeight * dpr;
      const ctx = canvas.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    if (width !== undefined && height !== undefined) {
      applySize(width, height);
      return;
    }

    applySize(canvas.clientWidth, canvas.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      const { width: w, height: h } = entry.contentRect;
      if (w > 0 && h > 0) applySize(w, h);
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [width, height]);

  // The continuous 60fps-target draw loop.
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;

      const rawLandmarks = landmarksRef.current;
      const analysis = poseAnalysisRef.current;

      // Ease displayed positions toward the latest raw landmarks.
      if (!rawLandmarks) {
        displayedRef.current = null;
      } else if (!displayedRef.current || displayedRef.current.length !== rawLandmarks.length) {
        displayedRef.current = rawLandmarks.map((p) => ({ ...p }));
      } else {
        displayedRef.current = displayedRef.current.map((p, i) => lerpLandmark(p, rawLandmarks[i], POSITION_SMOOTHING));
      }

      // Fade the ghost overlay in/out based on whether we have both a hand and a target to compare it to.
      const ghostTarget = analysis && displayedRef.current ? 1 : 0;
      ghostOpacityRef.current += (ghostTarget - ghostOpacityRef.current) * GHOST_FADE_SMOOTHING;

      pulsePhaseRef.current += dt * PULSE_RATE;

      draw(canvasRef.current, sizeRef.current, displayedRef.current, analysis ?? null, ghostOpacityRef.current, pulsePhaseRef.current, fpsRef.current);

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const canvasClassName = className ? `${styles.canvas} ${className}` : styles.canvas;

  return <canvas ref={canvasRef} className={canvasClassName} aria-hidden="true" />;
}

function draw(
  canvas: HTMLCanvasElement | null,
  size: { width: number; height: number },
  landmarks: HandLandmarks | null,
  poseAnalysis: PoseAnalysisResult | null,
  ghostOpacity: number,
  pulsePhase: number,
  fps: number | undefined
) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return;

  const { width: cssWidth, height: cssHeight } = size;
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  if (landmarks) {
    ctx.save();
    // Mirror to match the CSS-mirrored video feed.
    ctx.translate(cssWidth, 0);
    ctx.scale(-1, 1);

    // A gentle 0.7..1 pulse used to draw attention to incorrect fingers without being distracting.
    const pulseAlpha = 0.85 + 0.15 * Math.sin(pulsePhase * Math.PI * 2);

    drawLiveSkeleton(ctx, landmarks, poseAnalysis, cssWidth, cssHeight, pulseAlpha);

    if (poseAnalysis && ghostOpacity > 0.01) {
      drawGhostOverlay(ctx, landmarks, poseAnalysis, cssWidth, cssHeight, ghostOpacity);
    }

    ctx.restore(); // undo mirroring before drawing unmirrored UI text
  }

  if (fps !== undefined) {
    ctx.fillStyle = "#00ff00";
    ctx.font = "16px monospace";
    ctx.fillText(`FPS: ${fps}`, 12, 24);
  }
}

function drawLiveSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmarks,
  poseAnalysis: PoseAnalysisResult | null,
  cssWidth: number,
  cssHeight: number,
  pulseAlpha: number
) {
  HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
    const start = landmarks[startIdx];
    const end = landmarks[endIdx];
    if (!start || !end) return;

    let color = NEUTRAL_CONNECTION_COLOR;
    let lineWidth = 2;
    let alpha = 1;

    if (poseAnalysis) {
      const group = connectionGroup(startIdx, endIdx);
      const status = group === "palm" ? poseAnalysis.palm.status : poseAnalysis.fingers[group].status;
      if (status === "correct") {
        color = CORRECT_COLOR;
      } else if (status === "incorrect") {
        color = INCORRECT_COLOR;
        lineWidth = 3;
        alpha = pulseAlpha; // only pulse the fingers that actually need fixing
      } else {
        color = NEUTRAL_CONNECTION_COLOR; // palm "not_checked" for this letter
      }
    }

    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(start.x * cssWidth, start.y * cssHeight);
    ctx.lineTo(end.x * cssWidth, end.y * cssHeight);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  ctx.fillStyle = LANDMARK_COLOR;
  landmarks.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x * cssWidth, point.y * cssHeight, LANDMARK_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
  });
}

function drawGhostOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: HandLandmarks,
  poseAnalysis: PoseAnalysisResult,
  cssWidth: number,
  cssHeight: number,
  opacity: number
) {
  const centroid = palmCentroid(landmarks);
  const toXY = (p: NormalizedLandmark) => [p.x * cssWidth, p.y * cssHeight] as const;

  ctx.save();
  ctx.globalAlpha = opacity * 0.6; // kept subtle — a reference guide, not a second hand competing for attention
  ctx.strokeStyle = GHOST_COLOR;
  ctx.fillStyle = GHOST_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);

  for (const finger of FINGER_NAMES) {
    const expected = poseAnalysis.fingers[finger].expected;
    const ghost = computeGhostFinger(landmarks, finger, expected, centroid);
    const points = [ghost.mcp, ghost.pip, ghost.dip, ghost.tip];

    ctx.beginPath();
    const [firstX, firstY] = toXY(points[0]);
    ctx.moveTo(firstX, firstY);
    for (const p of points.slice(1)) {
      const [x, y] = toXY(p);
      ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const p of [ghost.pip, ghost.dip, ghost.tip]) {
      const [x, y] = toXY(p);
      ctx.beginPath();
      ctx.arc(x, y, GHOST_RADIUS, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  ctx.setLineDash([]);
  ctx.restore();
}
