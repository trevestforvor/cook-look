"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Coalesce rapid calls (slider drags, pointer moves) into at most one
 * invocation per animation frame, always using the latest arguments.
 *
 * Each wheel drag or slider tick triggers a synchronous full palette rebuild
 * (light + dark themes), which can fire dozens of times per second and freeze
 * the main thread. Throttling to one rebuild per frame keeps the UI responsive
 * while still tracking the input within ~16ms.
 */
export function useRafThrottle<A extends unknown[]>(
  fn: (...args: A) => void,
): (...args: A) => void {
  const frame = useRef<number | null>(null);
  const latest = useRef<A | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const throttled = useCallback((...args: A) => {
    latest.current = args;
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (latest.current) fnRef.current(...latest.current);
    });
  }, []);

  useEffect(
    () => () => {
      if (frame.current != null) cancelAnimationFrame(frame.current);
    },
    [],
  );

  return throttled;
}
