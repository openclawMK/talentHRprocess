import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const GRAD = "linear-gradient(135deg,#6366F1,#7C3AED)";
const avgColor = (v) => (v >= 70 ? "#047857" : v >= 40 ? "#D97706" : "#DC2626");

export default function CompanySelector() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState(null);
  const [a, setA] = useState(null);

  useEffect(() => {
    axios.get("/api/jobs").then((r) => setJobs(r.data)).catch(() => setJobs([]));
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(null));
  }, []);

  const roleMap = {};
  (a?.roles || []).forEach((x) => { roleMap[x.job_id] = x; });

  // Group jobs into companies (jobs without a company fall under "Other roles").
  const companies = {};
  (jobs || []).forEach((j) => {
    const c = j.company || { id: "other", name: "Other roles", industry: "Uncategorised", accent: "#6B7280", initials: "•" };
    const rm = roleMap[j.job_id] || { applicants: 0, avg: 0, g: 0, a: 0 };
    if (!companies[c.id]) companies[c.id] = { ...c, roles: 0, applicants: 0, avgSum: 0, avgN: 0, strong: 0, review: 0 };
    const C = companies[c.id];
    C.roles++; C.applicants += rm.applicants || 0; C.strong += rm.g || 0; C.review += rm.a || 0;
    if (rm.applicants > 0) { C.avgSum += rm.avg || 0; C.avgN++; }
  });
  const list = Object.values(companies);

  const summary = [
    { icon: "🏢", value: list.length, label: "Companies", accent: "#6366F1" },
    { icon: "▤", value: jobs?.length ?? 0, label: "Open roles", accent: "#7C3AED" },
    { icon: "👥", value: a?.total_applicants ?? 0, label: "Total applicants", accent: "#0EA5E9" },
    { icon: "✓", value: a?.green_count ?? 0, label: "Strong candidates", accent: "#059669" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }} className="flex-wrap">
        <div>
          <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 5px" }}>Companies</h1>
          <p style={{ fontSize: 15, color: "#6B7280", margin: 0 }}>Open a company to see its job roles.</p>
        </div>
        <button onClick={() => navigate("/jobs/new")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 20px rgba(99,102,241,.28)" }}>＋ Create job</button>
      </div>

      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 26 }}>
        {summary.map((s) => (
          <div key={s.label} style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 14, padding: "18px 20px", boxShadow: "0 1px 2px rgba(16,24,40,.04)", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.accent + "1A", color: s.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div><div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1 }}>{s.value}</div><div style={{ fontSize: 12.5, color: "#9AA0AE", marginTop: 3, fontWeight: 500 }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))", gap: 18 }}>
        {jobs === null
          ? Array.from({ length: 2 }).map((_, i) => <div key={i} style={{ background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, height: 200 }} className="animate-pulse" />)
          : list.map((c) => {
              const avg = c.avgN ? Math.round(c.avgSum / c.avgN) : 0;
              return (
                <div key={c.id} onClick={() => navigate(`/companies/${c.id}`)} style={{ position: "relative", background: "#fff", border: "1px solid #ECEDF2", borderRadius: 18, boxShadow: "0 1px 2px rgba(16,24,40,.04)", cursor: "pointer", overflow: "hidden" }} className="transition-all hover:-translate-y-0.5 hover:shadow-lg">
                  <div style={{ height: 4, background: c.accent }} />
                  <div style={{ padding: "24px 24px 22px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 15, marginBottom: 22 }}>
                      <div style={{ width: 54, height: 54, borderRadius: 15, background: c.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, flexShrink: 0 }}>{c.initials}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: "-.4px", lineHeight: 1.2 }}>{c.name}</div>
                        <div style={{ fontSize: 13, color: "#9AA0AE", marginTop: 4 }}>{c.industry}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
                      <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>{c.roles}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 4 }}>roles</div></div>
                      <div style={{ width: 1, height: 30, background: "#EEF0F4" }} />
                      <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1 }}>{c.applicants}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 4 }}>applicants</div></div>
                      <div style={{ width: 1, height: 30, background: "#EEF0F4" }} />
                      <div><div style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1, color: avgColor(avg) }}>{avg || "—"}</div><div style={{ fontSize: 12, color: "#9AA0AE", marginTop: 4 }}>avg score</div></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20, paddingTop: 16, borderTop: "1px solid #F1F2F6" }}>
                      <div style={{ fontSize: 12.5, color: "#6B7280" }}><b style={{ color: "#047857" }}>{c.strong}</b> strong · <b style={{ color: "#B45309" }}>{c.review}</b> to review</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c.accent }}>View roles →</span>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
