import { useCountUp } from "../hooks/useCountUp.js";

const HERO_STAT_TARGET = 20;
const HERO_STAT_LABEL = "Professionals";

const ORBITS = [
  { key: "orbit-1", diameter: 353, spin: "left", duration: 30 },
  { key: "orbit-2", diameter: 501, spin: "right", duration: 40 },
  { key: "orbit-3", diameter: 649, spin: "right", duration: 50 },
  { key: "orbit-4", diameter: 797, spin: "left", duration: 60 },
];

// pravatar.cc is a stable placeholder-avatar service (no account/key needed),
// used here instead of hotlinking a third-party design tool's asset export.
const avatarUrl = (id) => `https://i.pravatar.cc/300?img=${id}`;
const AVATARS = [
  { orbit: 3, angle: 30, size: 58, shape: "round", glow: "purple", src: avatarUrl(11), delay: 0.6 },
  { orbit: 3, angle: 95, size: 88, shape: "square-lg", glow: "orange", src: avatarUrl(12), delay: 0.9 },
  { orbit: 3, angle: 220, size: 88, shape: "square-lg", glow: "pink", src: avatarUrl(23), delay: 1.2 },
  { orbit: 3, angle: 320, size: 58, shape: "round", glow: "purple", src: avatarUrl(32), delay: 1.5 },
  { orbit: 2, angle: 130, size: 88, shape: "round", glow: "pink", src: avatarUrl(45), delay: 1.8 },
  { orbit: 1, angle: 60, size: 58, shape: "round", glow: "yellow", src: avatarUrl(51), delay: 2.0 },
  { orbit: 1, angle: 180, size: 78, shape: "square-lg", glow: "pink", src: avatarUrl(66), delay: 2.15 },
  { orbit: 1, angle: 300, size: 58, shape: "square-lg", glow: "blue", src: avatarUrl(15), delay: 2.3 },
  { orbit: 0, angle: 270, size: 58, shape: "square", glow: "purple", src: avatarUrl(26), delay: 2.45 },
];

// Split into a positioning wrapper (static transform — where on the circle,
// relative to its OWN orbit ring's center) and an inner element (animated
// transform — the fly-in). Keyframes replace the whole `transform` value
// while running/forwards, so the orbit placement and the entrance animation
// can never share one element's transform. Must be rendered INSIDE that
// orbit's own .orbit-spin div (not as a sibling) so the avatar actually
// travels around with the ring instead of sitting at a fixed point.
function Avatar({ diameter, angle, size, shape, glow, src, delay }) {
  const radius = diameter / 2;
  return (
    <div
      className="avatar-position"
      style={{ transform: `translate(-50%, -50%) rotate(${angle}deg) translate(${radius}px) rotate(${-angle}deg)` }}
    >
      <div className={`avatar avatar-${shape} glow-${glow} anim-fly-in`} style={{ width: size, height: size, animationDelay: `${delay}s` }}>
        <img src={src} alt="" width={size} height={size} />
      </div>
    </div>
  );
}

function CenterStat() {
  const value = useCountUp(HERO_STAT_TARGET, { durationMs: 2000, delayMs: 1200 });
  return (
    <div className="center-stat">
      <div className="center-stat-number font-display">{value}k+</div>
      <div className="center-stat-label font-display">{HERO_STAT_LABEL}</div>
    </div>
  );
}

function Orbit({ diameter, spin, duration, avatars, counterStat }) {
  return (
    <div className="orbit-center" style={{ width: diameter, height: diameter }}>
      <div className={`orbit-spin spin-${spin}`} style={{ animationDuration: `${duration}s` }}>
        <div className="orbit-ring-border" />
        {avatars}
      </div>
      {counterStat}
    </div>
  );
}

export default function CirclesVisualization() {
  return (
    <div className="circles-wrap">
      <div className="circles-stage anim-scale-in">
        {ORBITS.map((o, i) => (
          <Orbit
            key={o.key}
            diameter={o.diameter}
            spin={o.spin}
            duration={o.duration}
            avatars={AVATARS.filter((a) => a.orbit === i).map((a, j) => (
              <Avatar key={j} diameter={o.diameter} angle={a.angle} size={a.size} shape={a.shape} glow={a.glow} src={a.src} delay={a.delay} />
            ))}
            counterStat={
              i === 0 && (
                // Cancels this orbit's own rotation (opposite direction, same
                // duration) so the stat stays upright while its ring spins.
                <div className={`orbit-counter-spin spin-${o.spin === "left" ? "right" : "left"}`} style={{ animationDuration: `${o.duration}s` }}>
                  <CenterStat />
                </div>
              )
            }
          />
        ))}
      </div>
    </div>
  );
}
