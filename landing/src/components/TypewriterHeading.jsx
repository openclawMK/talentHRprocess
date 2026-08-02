import { useEffect, useState } from "react";

const LOOP_PAUSE_MS = 2000;

/**
 * Types `darkText + lightText` character by character, then pauses and
 * retypes from scratch — loops for as long as the hero is on screen. The
 * blinking cursor stays up throughout (it's a continuous CSS animation, not
 * tied to typing progress), same as the original.
 */
export default function TypewriterHeading({ darkText, lightText, speedMs = 35, startDelayMs = 400 }) {
  const full = darkText + lightText;
  const [count, setCount] = useState(0);

  useEffect(() => {
    let interval;
    let loopTimeout;

    const startTyping = () => {
      let i = 0;
      setCount(0);
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= full.length) {
          clearInterval(interval);
          loopTimeout = setTimeout(startTyping, LOOP_PAUSE_MS);
        }
      }, speedMs);
    };
    const startTimeout = setTimeout(startTyping, startDelayMs);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(loopTimeout);
      if (interval) clearInterval(interval);
    };
  }, [full, speedMs, startDelayMs]);

  const shown = full.slice(0, count);
  const shownDark = shown.slice(0, darkText.length);
  const shownLight = shown.slice(darkText.length);

  return (
    <h1 className="hero-heading font-display">
      <span className="hero-heading-dark">{shownDark}</span>
      <span className="hero-heading-light">{shownLight}</span>
      <span className="hero-cursor" aria-hidden="true" />
    </h1>
  );
}
