import { useEffect, useRef } from "react";
import styles from "./SkeletonCanvas.module.css";

export interface SkeletonCanvasProps {
  /** Width/height in CSS pixels the canvas should track. Usually the Camera frame's size. */
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Transparent overlay canvas meant to sit on top of the Camera preview.
 * It currently only keeps its backing store sized to its container —
 * hand/pose skeleton rendering will be added once pose detection
 * (e.g. MediaPipe) is integrated.
 */
export function SkeletonCanvas({ width, height, className }: SkeletonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = width ?? canvas.clientWidth;
    const cssHeight = height ?? canvas.clientHeight;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;

    const ctx = canvas.getContext("2d");
    ctx?.scale(dpr, dpr);
    // Intentionally blank: no skeleton is drawn until pose detection exists.
  }, [width, height]);

  const canvasClassName = className ? `${styles.canvas} ${className}` : styles.canvas;

  return <canvas ref={canvasRef} className={canvasClassName} aria-hidden="true" />;
}
