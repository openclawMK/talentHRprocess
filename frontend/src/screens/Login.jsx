import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const BORDER = "#ECEDF2";
const TEXT_SECONDARY = "#6B7280";
const ACCENT_1 = "#6366F1";
const ACCENT_2 = "#7C3AED";
const ACCENT_BG = "#F0F0FE";

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F5F6FA", padding: 20 }}>
      <div
        style={{
          width: "100%",
          maxWidth: 940,
          display: "flex",
          background: "#fff",
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          boxShadow: "0 1px 2px rgba(16,24,40,.04)",
          overflow: "hidden",
        }}
      >
        {/* Left hero */}
        <div
          className="relative hidden flex-col justify-between md:flex"
          style={{ width: "44%", background: GRAD, color: "#fff", padding: "44px 40px" }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 26 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "#fff", color: ACCENT_2, fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>PQ</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>PeopleQuest</div>
            </div>
            <div style={{ fontSize: 11, letterSpacing: "0.1em", opacity: 0.75, fontWeight: 600, marginBottom: 14, textTransform: "uppercase" }}>Talent AI</div>
            <h1 style={{ fontSize: 26, lineHeight: 1.25, fontWeight: 600, margin: "0 0 12px" }}>Hire with confidence, not guesswork.</h1>
            <p style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.6, margin: "0 0 18px" }}>
              Score CVs, run OCEAN personality assessments, and interview against a transparent 3-layer model — all in one workspace.
            </p>
            <div>
              {[
                "Score 200 CVs while you make coffee",
                "Transparent 3-layer scoring, no black box",
                "Hire / Hold / Reject — decided, not guessed",
              ].map((t) => (
                <div key={t} style={{ display: "flex", gap: 8, fontSize: 12.5, opacity: 0.92, marginBottom: 9 }}>
                  <span>✓</span>{t}
                </div>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11, opacity: 0.65 }}>PeopleQuest Sdn Bhd · Kuala Lumpur</div>
        </div>

        {/* Right form */}
        <div className="flex flex-1 items-center justify-center" style={{ padding: 30 }}>
          <form onSubmit={submit} style={{ width: "100%", maxWidth: 340 }}>
            <h1 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 3px" }}>Welcome back</h1>
            <p style={{ fontSize: 12.5, color: TEXT_SECONDARY, margin: "0 0 18px" }}>Sign in to your HR workspace.</p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: TEXT_SECONDARY, marginBottom: 6 }}>Work email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "8px 11px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", color: "#111827", outline: "none" }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: TEXT_SECONDARY, marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: "100%", fontSize: 13, padding: "8px 11px", borderRadius: 10, border: `1px solid ${BORDER}`, background: "#fff", color: "#111827", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: TEXT_SECONDARY, marginBottom: 16 }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
                <input type="checkbox" checked={remember} onChange={() => setRemember((v) => !v)} style={{ width: "auto" }} />
                Remember me
              </label>
              <a style={{ color: ACCENT_1, cursor: "pointer" }}>Forgot password?</a>
            </div>

            {error && <p style={{ color: "#DC2626", fontSize: 13, margin: "0 0 14px" }}>{error}</p>}

            <button
              type="submit"
              disabled={busy}
              style={{ width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 10, fontSize: 13, fontWeight: 500, background: GRAD, color: "#fff", border: "none", cursor: "pointer", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>

            <div style={{ background: ACCENT_BG, borderRadius: 12, padding: "12px 14px", fontSize: 12, color: ACCENT_2, marginTop: 16 }}>
              <b>Demo credentials</b><br />hr@peoplequest.my / peoplequest
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
