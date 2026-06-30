import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const ACCENTS = [
  { color: "#6366F1", bg: "#EEF2FF", avatar: "#6366F1" },
  { color: "#0D9488", bg: "#ECFDF5", avatar: "#0D9488" },
  { color: "#DB2777", bg: "#FCE7F3", avatar: "#DB2777" },
  { color: "#D97706", bg: "#FFF7ED", avatar: "#D97706" },
  { color: "#0EA5E9", bg: "#E0F2FE", avatar: "#0EA5E9" },
];
const AV = ["#6366F1", "#0EA5E9", "#059669", "#F59E0B", "#EC4899", "#14B8A6"];
const avColor = (s) => { let h = 0; for (const c of s || "") h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
const avgColor = (v) => (v >= 70 ? "#047857" : v >= 40 ? "#D97706" : "#DC2626");

export default function JobSelector() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);
  const [a, setA] = useState(null);

  useEffect(() => {
    axios.get("/api/jobs").then((r) => setJobs(r.data)).catch(() => setJobs([]));
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(null));
  }, []);

  const roleMap = {};
  (a?.roles || []).forEach((x) => { roleMap[x.job_id] = x; });

  const summary = [
    { icon: "▤", value: a?.open_roles ?? (jobs?.length || 0), label: "Open roles", accent: "#6366F1" },
    { icon: "👥", value: a?.total_applicants ?? 0, label: "Total applicants", accent: "#0EA5E9" },
    { icon: "✓", value: a?.green_count ?? 0, label: "Strong candidates", accent: "#059669" },
    { icon: "⚠", value: a?.lane_breakdown?.amber?.count ?? 0, label: "Need review", accent: "#D97706" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 5px" }}>Job roles</h1>
          <p style={{ fontSize: 15, color: "#6B7280", margin: 0 }}>Open a role to review applicants, or create a new one.</p>
        </div>
        <button onClick={() => navigate("/jobs/new")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 20px rgba(99,102,241,.28)" }}>＋ Create job</button>
      </div>

      {/* summary stat cards */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 26 }}>
        {summary.map((s) => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.accent + "1A", color: s.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div><div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1 }}>{s.value}</div><div style={{ fontSize: 12.5, color: "#9AA0AE", marginTop: 3, fontWeight: 500 }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* role cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 18 }}>
        {jobs === null
          ? Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, height: 220 }} className="animate-pulse" />)
          : jobs.map((j, i) => {
              const acc = ACCENTS[i % ACCENTS.length];
              const r = roleMap[j.job_id] || { applicants: 0, avg: 0, g: 0, a: 0, r: 0, avatars: [], more: 0 };
              const tot = Math.max(1, r.g + r.a + r.r);
              const needsReview = r.a > 0;
              const mono = j.role_title.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ position: "relative", background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, boxShadow: "0 1px 2px rgba(16,24,40,.04)", cursor: "pointer", overflow: "hidden" }} className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <div style={{ height: 4, background: acc.color }} />
                  <div style={{ padding: "22px 24px 24px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 13, background: acc.bg, color: acc.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{mono}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17.5, fontWeight: 700, letterSpacing: "-.3px", lineHeight: 1.25, marginBottom: 6 }}>{j.role_title}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: acc.color, background: acc.bg, padding: "3px 9px", borderRadius: 6 }}>{j.industry}</span>
                          <span style={{ fontSize: 13, color: "#9AA0AE" }}>📍 {j.location}</span>
                        </div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", padding: "4px 10px", borderRadius: 20, ...(needsReview ? { color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A" } : { color: "#047857", background: "#ECFDF5", border: "1px solid #A7F3D0" }) }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: needsReview ? "#D97706" : "#059669" }} />{needsReview ? `${r.a} need review` : "On track"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                        <div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1 }}>{r.applicants}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 4 }}>applicants</div></div>
                        <div style={{ width: 1, height: 34, background: "#EEF0F4" }} />
                        <div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1, color: avgColor(r.avg) }}>{r.avg}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 4 }}>avg score</div></div>
                      </div>
                      {r.avatars?.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {r.avatars.map((ini, k) => <div key={k} style={{ width: 30, height: 30, borderRadius: "50%", background: avColor(ini + k), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: "2px solid #fff", marginLeft: k ? -8 : 0 }}>{ini}</div>)}
                          {r.more > 0 && <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#F1F2F6", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, border: "2px solid #fff", marginLeft: -8 }}>+{r.more}</div>}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: "#F3F4F8" }}>
                      <div style={{ width: `${(r.g / tot) * 100}%`, background: "#059669" }} />
                      <div style={{ width: `${(r.a / tot) * 100}%`, background: "#D97706" }} />
                      <div style={{ width: `${(r.r / tot) * 100}%`, background: "#DC2626" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13 }}>
                      <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: "#6B7280" }}><span><b style={{ color: "#047857" }}>{r.g}</b> strong</span><span><b style={{ color: "#B45309" }}>{r.a}</b> review</span><span><b style={{ color: "#B91C1C" }}>{r.r}</b> gaps</span></div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: acc.color }}>View →</span>
                    </div>
                  </div>
                </div>
              );
            })}

        {jobs !== null && (
          <div onClick={() => navigate("/jobs/new")} style={{ border: "1.5px dashed #D6D8E3", borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer", minHeight: 220 }} className="transition-colors hover:border-violet-300 hover:bg-violet-50/30">
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: "#F3F4F8", color: "#6B7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>＋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#374151" }}>Create new role</div>
            <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 4, maxWidth: 180 }}>AI drafts the scoring criteria from your job description</div>
          </div>
        )}
      </div>
    </div>
  );
}
