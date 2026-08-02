import { useEffect, useState } from "react";

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const STEP_MS = 30;

/**
 * Animates 0 -> target over durationMs, starting after delayMs. Uses a plain
 * interval keyed off elapsed wall-clock time rather than requestAnimationFrame
 * — rAF is tied to the tab's compositor and simply never fires for a
 * backgrounded/non-composited tab, which a count-up stat shouldn't depend on.
 */
export function useCountUp(target, { durationMs = 2000, delayMs = 1200 } = {}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let interval = null;
    const timeout = setTimeout(() => {
      const start = Date.now();
      interval = setInterval(() => {
        const progress = Math.min(1, (Date.now() - start) / durationMs);
        setValue(Math.round(easeOutCubic(progress) * target));
        if (progress >= 1) clearInterval(interval);
      }, STEP_MS);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [target, durationMs, delayMs]);

  return value;
}
