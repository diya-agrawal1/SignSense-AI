import { useEffect, useRef } from "react";
import { HAND_CONNECTIONS } from "../../models/handTracking";
import type { HandLandmarks } from "../../models/handTracking";
import styles from "./SkeletonCanvas.module.css";

export interface SkeletonCanvasProps {
  /** Width/height in CSS pixels the canvas should track. Usually the Camera frame's size. */
  width?: number;
  height?: number;
  /** 21 hand landmarks to draw, or null when no hand is detected. */
  landmarks?: HandLandmarks | null;
  /** Optional FPS readout drawn in the corner. Omit to hide it. */
  fps?: number;
  className?: string;
}

const LANDMARK_COLOR = "#00e5ff";
const CONNECTION_COLOR = "#ffffff";
const LANDMARK_RADIUS = 4;

/**
 * Transparent overlay canvas that sits on top of the Camera preview.
 * Keeps its backing store sized (and DPR-scaled) to its container, and
 * draws hand landmarks + skeleton connections whenever they change.
 *
 * Drawing coordinates are mirrored to match the Camera video, which is
 * mirrored via CSS (`transform: scaleX(-1)` in Camera.module.css) —
 * mirroring here in canvas-space keeps that CSS untouched.
 */
export function SkeletonCanvas({ width, height, landmarks, fps, className }: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  // Keep the backing store sized (and DPR-scaled) to the container.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = width ?? canvas.clientWidth;
    const cssHeight = height ?? canvas.clientHeight;
    sizeRef.current = { width: cssWidth, height: cssHeight };

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
  }, [width, height]);

  // Redraw whenever landmarks (or the FPS readout) change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const { width: cssWidth, height: cssHeight } = sizeRef.current;
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.save();

    // Mirror to match the CSS-mirrored video feed.
    ctx.translate(cssWidth, 0);
    ctx.scale(-1, 1);

    if (landmarks) {
      ctx.strokeStyle = CONNECTION_COLOR;
      ctx.lineWidth = 2;
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const start = landmarks[startIdx];
        const end = landmarks[endIdx];
        if (!start || !end) return;
        ctx.beginPath();
        ctx.moveTo(start.x * cssWidth, start.y * cssHeight);
        ctx.lineTo(end.x * cssWidth, end.y * cssHeight);
        ctx.stroke();
      });

      ctx.fillStyle = LANDMARK_COLOR;
      landmarks.forEach((point) => {
        ctx.beginPath();
        ctx.arc(point.x * cssWidth, point.y * cssHeight, LANDMARK_RADIUS, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    ctx.restore(); // undo mirroring before drawing unmirrored UI text

    if (fps !== undefined) {
      ctx.fillStyle = "#00ff00";
      ctx.font = "16px monospace";
      ctx.fillText(`FPS: ${fps}`, 12, 24);
    }
  }, [landmarks, fps]);

  const canvasClassName = className ? `${styles.canvas} ${className}` : styles.canvas;

  return <canvas ref={canvasRef} className={canvasClassName} aria-hidden="true" />;
}
