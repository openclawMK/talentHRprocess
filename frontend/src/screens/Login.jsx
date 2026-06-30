import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";

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
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Left hero */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden md:flex"
        style={{
          width: "46%",
          background: "linear-gradient(155deg, #312E81 0%, #4F46E5 52%, #7C3AED 100%)",
          color: "#fff",
          padding: "56px 60px",
        }}
      >
        <div style={{ position: "absolute", width: 460, height: 460, borderRadius: "50%", background: "rgba(255,255,255,.07)", top: -160, right: -140 }} />
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,.05)", bottom: -120, left: -80 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 18 }}>PQ</div>
          <div style={{ fontWeight: 700, fontSize: 19, letterSpacing: "-.2px" }}>PeopleQuest</div>
        </div>

        <div style={{ position: "relative" }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: "1.4px", textTransform: "uppercase", opacity: 0.7, marginBottom: 18 }}>Talent AI</div>
          <h1 className="font-display" style={{ fontSize: 42, lineHeight: 1.12, fontWeight: 800, margin: "0 0 20px", letterSpacing: "-1px" }}>
            Hire with<br />confidence, not<br />guesswork.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, opacity: 0.82, maxWidth: 380, margin: "0 0 30px" }}>
            AI screens every CV, scores candidates across multiple dimensions, and tells you who to hire — with the reasons to back it up.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              "Score 200 CVs in the time it takes to read one",
              "Transparent 3-layer scoring you can defend",
              "Hire / Hold / Reject with a confidence level",
            ].map((t) => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 15 }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>✓</span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", fontSize: 13, opacity: 0.6 }}>PeopleQuest Sdn Bhd · Kuala Lumpur</div>
      </div>

      {/* Right form */}
      <div className="flex flex-1 items-center justify-center p-10" style={{ backgroundColor: "#fff" }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 380 }}>
          <h2 className="font-display" style={{ fontSize: 26, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-.4px" }}>Welcome back</h2>
          <p style={{ fontSize: 15, color: "#6B7280", margin: "0 0 30px" }}>Sign in to your HR workspace</p>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Work email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 15, color: "#111827", marginBottom: 18, background: "#fff", outline: "none" }}
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 7 }}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", border: "1px solid #E2E4EC", borderRadius: 10, fontSize: 15, color: "#111827", marginBottom: 14, background: "#fff", outline: "none" }}
          />

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#4B5563", cursor: "pointer" }}>
              <span
                onClick={() => setRemember((v) => !v)}
                style={{ width: 16, height: 16, borderRadius: 5, background: remember ? GRAD : "#E2E4EC", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 11 }}
              >
                {remember ? "✓" : ""}
              </span>
              Remember me
            </label>
            <a style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer" }}>Forgot password?</a>
          </div>

          {error && <p style={{ color: "#DC2626", fontSize: 14, margin: "0 0 14px" }}>{error}</p>}

          <button
            type="submit"
            disabled={busy}
            style={{ width: "100%", padding: 13, background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 15, cursor: "pointer", boxShadow: "0 6px 18px rgba(99,102,241,.32)", opacity: busy ? 0.7 : 1 }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>

          <div style={{ marginTop: 24, padding: "14px 16px", background: "#F5F3FF", border: "1px solid #E9E5FF", borderRadius: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9", letterSpacing: ".4px", textTransform: "uppercase", marginBottom: 6 }}>Demo credentials</div>
            <div style={{ fontSize: 13, color: "#5B5570", lineHeight: 1.7 }}>
              Email <b style={{ color: "#312E81" }}>hr@peoplequest.my</b><br />
              Password <b style={{ color: "#312E81" }}>peoplequest</b>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
