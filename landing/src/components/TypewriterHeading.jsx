import { useEffect, useState } from "react";

/**
 * Types `darkText + lightText` character by character. darkText renders in
 * --ink (plain statement), lightText in a gradient accent (the payoff) —
 * a two-tone effect, just inverted from a light-background template since
 * our hero sits on a dark glow, not a photo.
 */
export default function TypewriterHeading({ darkText, lightText, speedMs = 35, startDelayMs = 400 }) {
  const full = darkText + lightText;
  const [count, setCount] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    let interval;
    const startTimeout = setTimeout(() => {
      interval = setInterval(() => {
        i += 1;
        setCount(i);
        if (i >= full.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speedMs);
    }, startDelayMs);

    return () => {
      clearTimeout(startTimeout);
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
      {!done && <span className="hero-cursor" aria-hidden="true" />}
    </h1>
  );
}
