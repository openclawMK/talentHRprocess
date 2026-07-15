import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

const D = {
  page: "#0B0B0D",
  inset: "#0E1016",
  border: "#24252C",
  text: "#F4F5F7",
  text2: "#C9CAD0",
  text3: "#8A8B92",
  text4: "#6E6F76",
  text5: "#5C5D66",
  blue: "#4C7DFB",
  green: "#3FB984",
};
const GRAD_BTN = "linear-gradient(150deg,#3B6FF6,#6D4BF0)";

const KEYFRAMES = `
@keyframes pqauth { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
@keyframes pqglow { 0%, 100% { opacity: 0.55; transform: translate(0px, 0px) scale(1); } 50% { opacity: 1; transform: translate(6%, -4%) scale(1.2); } }
`;

// Faint drifting grid with slowly-pulsing glow nodes, matching the mockup's canvas hero background.
function GridCanvas() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const parent = canvas.parentElement;
    let raf;
    let nodes = [];

    function resize() {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const spacing = 46;
      const cols = Math.ceil(w / spacing);
      const rows = Math.ceil(h / spacing);
      nodes = Array.from({ length: 16 }, () => ({
        x: Math.round(Math.random() * cols) * spacing,
        y: Math.round(Math.random() * rows) * spacing,
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.5,
      }));
    }

    function draw(t) {
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const spacing = 46;

      ctx.strokeStyle = "rgba(76,125,251,0.07)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= w; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      for (const n of nodes) {
        const glow = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 0.001 * n.speed + n.phase));
        const r = 34;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
        g.addColorStop(0, `rgba(120,150,255,${glow})`);
        g.addColorStop(1, "rgba(120,150,255,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    }

    resize();
    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return <canvas ref={ref} style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

const TICKS = [
  "Score 200 CVs while you make coffee",
  "Transparent 3-layer scoring, no black box",
  "Hire / Hold / Reject — decided, not guessed",
];

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("hr@peoplequest.my");
  const [password, setPassword] = useState("peoplequest");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      login(res.data.token, res.data.user, remember);
      navigate("/");
    } catch {
      setError("Invalid email or password");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle = { width: "100%", padding: "10px 13px", background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 11, color: D.text, fontSize: 13, outline: "none", marginBottom: 16 };
  const labelStyle = { display: "block", fontSize: 12, color: D.text3, marginBottom: 7, fontWeight: 500 };

  return (
    <div style={{ minHeight: "100vh", display: "flex", background: D.page }}>
      <style>{KEYFRAMES}</style>

      {/* Left hero */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden md:flex"
        style={{ width: "54%", background: "radial-gradient(120% 90% at 15% 10%, #1B2545 0%, #0E1016 55%)", padding: "56px 60px" }}
      >
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(59,111,246,.28), rgba(109,75,240,.3), rgba(59,111,246,.12), rgba(109,75,240,.28))", backgroundSize: "300% 300%", animation: "pqauth 16s ease infinite", pointerEvents: "none" }} />
        <GridCanvas />
        <div style={{ position: "absolute", top: "-15%", left: "-10%", width: 520, height: 520, borderRadius: "50%", background: "radial-gradient(circle, rgba(76,125,251,.35), transparent 70%)", filter: "blur(20px)", animation: "pqglow 12s ease-in-out infinite", pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: "-20%", right: "-5%", width: 460, height: 460, borderRadius: "50%", background: "radial-gradient(circle, rgba(109,75,240,.32), transparent 70%)", filter: "blur(20px)", animation: "pqglow 14s ease-in-out infinite reverse", pointerEvents: "none" }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 56 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: GRAD_BTN, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, color: "#fff" }}>P</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>PeopleQuest <span style={{ color: D.text4, fontWeight: 500 }}>Talent AI</span></div>
          </div>

          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: D.blue, fontWeight: 700, marginBottom: 16, textTransform: "uppercase" }}>Talent AI</div>
          <h1 style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.02em", margin: "0 0 16px", maxWidth: 460, color: "#fff" }}>
            Hire with confidence, not guesswork.
          </h1>
          <p style={{ fontSize: 14, color: D.text3, lineHeight: 1.7, maxWidth: 420, margin: "0 0 28px" }}>
            Score CVs, run OCEAN personality assessments, and interview against a transparent 3-layer model — all in one workspace.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 13.5, color: D.text2 }}>
            {TICKS.map((t) => (
              <div key={t} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(63,185,132,.15)", color: D.green, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, flexShrink: 0 }}>✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, fontSize: 11.5, color: D.text5 }}>PeopleQuest Sdn Bhd · Kuala Lumpur</div>
      </div>

      {/* Right form */}
      <div
        className="flex flex-1 items-center justify-center"
        style={{ padding: 40, background: "radial-gradient(120% 90% at 80% 10%, rgba(59,111,246,.14), transparent 55%), radial-gradient(100% 80% at 60% 100%, rgba(109,75,240,.12), transparent 60%), linear-gradient(160deg, #0E1018, #0B0B0D)" }}
      >
        <form
          onSubmit={submit}
          style={{ width: "100%", maxWidth: 360, background: "linear-gradient(150deg, rgba(59,111,246,.06), rgba(255,255,255,.02))", border: "0.5px solid rgba(255,255,255,.08)", borderRadius: 20, padding: "34px 30px", backdropFilter: "blur(18px)", boxShadow: "0 24px 60px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.05)" }}
        >
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 6px", color: D.text }}>Welcome back</h2>
          <p style={{ fontSize: 13, color: D.text3, margin: "0 0 26px" }}>Sign in to your HR workspace.</p>

          <label style={labelStyle}>Work email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: D.text3, marginBottom: 20 }}>
            <label style={{ display: "flex", gap: 7, alignItems: "center", cursor: "pointer" }}>
              <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} style={{ width: "auto" }} />
              Remember me
            </label>
            <a style={{ color: D.blue, cursor: "pointer" }}>Forgot password?</a>
          </div>

          {error && <p style={{ color: "#E5654C", fontSize: 13, margin: "0 0 16px" }}>{error}</p>}

          <button
            type="submit"
            disabled={busy}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 30px", color: "#fff", background: GRAD_BTN, border: "none", borderRadius: 12, fontWeight: 600, fontSize: 16, letterSpacing: "0.01em", cursor: "pointer", boxShadow: "inset 0 1px 0 rgba(255,255,255,.04), 0 8px 24px rgba(0,0,0,.25)", opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div style={{ background: D.inset, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "12px 14px", marginTop: 18, fontSize: 12, color: D.text3 }}>
            <b style={{ color: D.text2 }}>Demo credentials</b><br />hr@peoplequest.my / peoplequest
          </div>
        </form>
      </div>
    </div>
  );
}
