import { useState } from "react";
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
@keyframes pqgrid { from { background-position: 0px 0px; } to { background-position: 46px 46px; } }
@keyframes pqtwinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.65; } }
`;

// Faint drifting grid with a few pulsing glow nodes, matching the mockup's animated hero
// background. Pure CSS (no rAF/canvas) so it's driven by the compositor, not a JS loop.
const GRID_NODES = [
  { top: "14%", left: "22%", delay: "0s", duration: "5.5s" },
  { top: "38%", left: "68%", delay: "1.2s", duration: "6.2s" },
  { top: "62%", left: "34%", delay: "2.4s", duration: "4.8s" },
  { top: "78%", left: "58%", delay: "0.6s", duration: "5.8s" },
  { top: "26%", left: "48%", delay: "3s", duration: "6.6s" },
];

function GridBackground() {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(76,125,251,0.09) 0px, rgba(76,125,251,0.09) 1px, transparent 1px, transparent 46px), repeating-linear-gradient(0deg, rgba(76,125,251,0.09) 0px, rgba(76,125,251,0.09) 1px, transparent 1px, transparent 46px)",
          animation: "pqgrid 6s linear infinite",
        }}
      />
      {GRID_NODES.map((n, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: n.top,
            left: n.left,
            width: 68,
            height: 68,
            marginLeft: -34,
            marginTop: -34,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(120,150,255,0.7), transparent 70%)",
            animation: `pqtwinkle ${n.duration} ease-in-out infinite`,
            animationDelay: n.delay,
          }}
        />
      ))}
    </div>
  );
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
      login(res.data.token, res.data.user, remember, res.data.permissions);
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
        <GridBackground />
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
