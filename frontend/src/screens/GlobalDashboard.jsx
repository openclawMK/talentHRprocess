import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const card = { background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, boxShadow: "0 1px 2px rgba(16,24,40,.04)" };

const QUICK = [
  { icon: "↥", title: "Upload & score CV", sub: "Parse a PDF or DOCX CV and auto-score it", ibg: "#EEF2FF", ic: "#4F46E5", to: "/upload" },
  { icon: "＋", title: "Create job role", sub: "Draft scoring criteria automatically with AI", ibg: "#F5F3FF", ic: "#7C3AED", to: "/jobs/new" },
  { icon: "💼", title: "Companies", sub: "Manage the businesses you're hiring for", ibg: "#ECFDF5", ic: "#059669", to: "/companies" },
  { icon: "💰", title: "Salary Center", sub: "Benchmark pay against the Malaysian market", ibg: "#FFF7ED", ic: "#C2410C", to: "/salary-center" },
];

const FUNNEL = [
  { key: "cv_submission", label: "CV review" },
  { key: "ocean_assessment", label: "OCEAN" },
  { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" },
];

export default function GlobalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [a, setA] = useState(null);

  useEffect(() => {
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(false));
  }, []);

  const firstName = (user?.name || "there").split(" ")[0];
  const h = new Date().getHours();
  const greeting = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";

  if (a === null) return <div style={{ ...card, height: 320 }} className="animate-pulse" />;

  const lanes = a?.lane_breakdown || { green: { count: 0, pct: 0 }, amber: { count: 0, pct: 0 }, red: { count: 0, pct: 0 } };
  const funMax = Math.max(1, ...FUNNEL.map((f) => a?.by_stage?.[f.key] ?? 0));

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 24 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.6px", margin: "0 0 5px" }}>{greeting}, {firstName} 👋</h1>
          <p style={{ fontSize: 15, color: "#6B7280", margin: 0 }}>Here's what's happening across your {a?.open_roles ?? 0} open role{a?.open_roles === 1 ? "" : "s"} today.</p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("/upload")} style={{ padding: "11px 16px", background: "#fff", color: "#374151", border: "1px solid #E2E4EC", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer" }}>↥ Upload CV</button>
          <button onClick={() => navigate("/jobs/new")} style={{ padding: "11px 16px", background: GRAD, color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(99,102,241,.28)" }}>＋ Create job</button>
        </div>
      </div>

      {/* Quick tools */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "#9AA0AE", letterSpacing: ".5px", textTransform: "uppercase", marginBottom: 12 }}>Quick tools</div>
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 22 }}>
        {QUICK.map((q) => (
          <div key={q.title} onClick={() => navigate(q.to)} style={{ ...card, borderColor: "#ECEDF2", borderRadius: 14, padding: 18, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
            <div style={{ width: 40, height: 40, borderRadius: 11, background: q.ibg, color: q.ic, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 19, marginBottom: 12 }}>{q.icon}</div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>{q.title}</div>
            <div style={{ fontSize: 12.5, color: "#9AA0AE", lineHeight: 1.45 }}>{q.sub}</div>
          </div>
        ))}
      </div>

      {/* Stale alert */}
      {a?.stale_top && (
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 14, marginBottom: 22 }} className="flex-wrap">
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>⚠️</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <span style={{ fontWeight: 700, color: "#92400E" }}>{a.stale_top.name}</span>
            <span style={{ color: "#B45309" }}> has been waiting in {a.stale_top.current_stage.replace("_", " ")} for {a.stale_top.days_waiting} days.</span>
            {a.stale_count > 1 && <span style={{ color: "#B45309" }}> {a.stale_count} candidates across your roles are going stale.</span>}
          </div>
          <button onClick={() => navigate("/jobs")} style={{ padding: "8px 14px", background: "#D97706", color: "#fff", border: "none", borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Review now</button>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" style={{ marginBottom: 16 }}>
        <Stat label="Total applicants" icon="👥" ibg="#EEF2FF" value={a?.total_applicants ?? 0} sub={`Across ${a?.open_roles ?? 0} open roles`} subColor="#6B7280" />
        <Stat label="Average score" icon="◎" ibg="#F5F3FF" value={a?.avg_score ?? 0} suffix="/100" sub="Across all open roles" subColor="#6B7280" />
        <Stat label="Green candidates" icon="✓" ibg="#ECFDF5" value={a?.green_count ?? 0} valColor="#059669" sub="Ready to advance" subColor="#6B7280" />
        <Stat label="In interview" icon="◷" ibg="#EEF2FF" value={a?.in_interview ?? 0} sub={`${a?.offers_pending ?? 0} offers pending`} subColor="#6B7280" />
      </div>

      {/* Funnel + Lane breakdown */}
      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]" style={{ marginBottom: 26 }}>
        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Pipeline funnel</div>
          <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 20 }}>Candidates by current stage</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {FUNNEL.map((f) => {
              const n = a?.by_stage?.[f.key] ?? 0;
              return (
                <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 78, fontSize: 13, fontWeight: 600, color: "#4B5563" }}>{f.label}</div>
                  <div style={{ flex: 1, height: 26, background: "#F3F4F8", borderRadius: 8, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(n / funMax) * 100}%`, background: "linear-gradient(90deg,#818CF8,#7C3AED)", borderRadius: 8 }} />
                  </div>
                  <div style={{ width: 30, textAlign: "right", fontSize: 14, fontWeight: 700 }}>{n}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...card, padding: "22px 24px" }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Lane breakdown</div>
          <div style={{ fontSize: 13, color: "#9AA0AE", marginBottom: 20 }}>AI fit across all candidates</div>
          <div style={{ display: "flex", height: 14, borderRadius: 8, overflow: "hidden", marginBottom: 22, background: "#F3F4F8" }}>
            <div style={{ width: `${lanes.green.pct}%`, background: "#059669" }} />
            <div style={{ width: `${lanes.amber.pct}%`, background: "#D97706" }} />
            <div style={{ width: `${lanes.red.pct}%`, background: "#DC2626" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {[
              { c: "#059669", label: "Green · strong fit", d: lanes.green },
              { c: "#D97706", label: "Amber · review", d: lanes.amber },
              { c: "#DC2626", label: "Red · likely no", d: lanes.red },
            ].map((l) => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: l.c }} />
                <span style={{ fontSize: 14, color: "#374151", flex: 1 }}>{l.label}</span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{l.d.count}</span>
                <span style={{ fontSize: 13, color: "#9AA0AE", width: 38, textAlign: "right" }}>{l.d.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active job roles */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="font-display" style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Active job roles</h2>
        <span onClick={() => navigate("/jobs")} style={{ fontSize: 14, color: "#6366F1", fontWeight: 600, cursor: "pointer" }}>View all →</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(a?.roles || []).map((j) => {
          const tot = Math.max(1, j.g + j.a + j.r);
          return (
            <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ ...card, padding: 22, cursor: "pointer" }} className="transition-shadow hover:shadow-md">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-.3px", marginBottom: 6 }}>{j.title}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", padding: "3px 9px", borderRadius: 6 }}>{j.dept}</span>
                    <span style={{ fontSize: 13, color: "#9AA0AE" }}>{j.location}</span>
                  </div>
                </div>
                {j.stale > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 8px", borderRadius: 20, whiteSpace: "nowrap" }}>⚠ {j.stale} stale</span>}
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 14 }}>
                <div><div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>{j.applicants}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 3 }}>applicants</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontSize: 20, fontWeight: 700, color: "#4F46E5", lineHeight: 1 }}>{j.avg}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 3 }}>avg score</div></div>
              </div>
              <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "#F3F4F8" }}>
                <div style={{ width: `${(j.g / tot) * 100}%`, background: "#059669" }} />
                <div style={{ width: `${(j.a / tot) * 100}%`, background: "#D97706" }} />
                <div style={{ width: `${(j.r / tot) * 100}%`, background: "#DC2626" }} />
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 12, color: "#6B7280" }}>
                <span>🟢 {j.g} green</span><span>🟡 {j.a} amber</span><span>🔴 {j.r} red</span>
              </div>
            </div>
          );
        })}
        {(a?.roles || []).length === 0 && <div style={{ ...card, padding: 24 }} className="col-span-full text-center text-sm text-gray-400">No roles yet.</div>}
      </div>
    </div>
  );
}

function Stat({ label, icon, ibg, value, suffix, sub, subColor, valColor }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 13, color: "#6B7280", fontWeight: 600 }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 10, background: ibg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: valColor || "#111827" }}>
        {value}{suffix && <span style={{ fontSize: 18, color: "#9AA0AE" }}>{suffix}</span>}
      </div>
      <div style={{ fontSize: 13, color: subColor, fontWeight: 500, marginTop: 8 }}>{sub}</div>
    </div>
  );
}
