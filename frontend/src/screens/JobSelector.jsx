import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { usePalette } from "../context/ThemeContext.jsx";

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

export default function JobSelector() {
  const navigate = useNavigate();
  const { companyId } = useParams();
  const D = usePalette();
  const avgColor = (v) => (v >= 70 ? D.green : v >= 40 ? D.amber : D.red);
  const [jobs, setJobs] = useState(null);
  const [a, setA] = useState(null);
  const [company, setCompany] = useState(null);

  useEffect(() => {
    axios.get("/api/jobs").then((r) => setJobs(r.data)).catch(() => setJobs([]));
    axios.get("/api/analytics").then((r) => setA(r.data)).catch(() => setA(null));
    if (companyId) axios.get(`/api/companies/${companyId}`).then((r) => setCompany(r.data)).catch(() => setCompany(null));
    else setCompany(null);
  }, [companyId]);

  async function deleteJob(e, j, applicantCount) {
    e.stopPropagation();
    const warn = applicantCount > 0 ? `This role has ${applicantCount} candidate${applicantCount === 1 ? "" : "s"} — deleting it will also delete them and their scores. ` : "";
    if (!window.confirm(`${warn}Delete ${j.role_title}? This can't be undone.`)) return;
    try {
      await axios.delete(`/api/jobs/${j.job_id}`);
      setJobs((js) => js.filter((x) => x.job_id !== j.job_id));
    } catch (err) {
      window.alert(err?.response?.data?.error || "Couldn't delete this role.");
    }
  }

  const roleMap = {};
  (a?.roles || []).forEach((x) => { roleMap[x.job_id] = x; });

  // When opened from a company, show only that company's roles + a company header
  // fetched directly (not inferred from job data, since a company can have 0 roles).
  const shown = companyId ? (jobs || []).filter((j) => (j.company?.id || "other") === companyId) : jobs;

  const summary = [
    { icon: "▤", value: a?.open_roles ?? (jobs?.length || 0), label: "Open roles", accent: D.blue },
    { icon: "👥", value: a?.total_applicants ?? 0, label: "Total applicants", accent: "#0EA5E9" },
    { icon: "✓", value: a?.green_count ?? 0, label: "Strong candidates", accent: D.green },
    { icon: "⚠", value: a?.lane_breakdown?.amber?.count ?? 0, label: "Need review", accent: D.amber },
  ];

  return (
    <div>
      {companyId && (
        <div onClick={() => navigate("/companies")} style={{ fontSize: 14, color: D.blue, fontWeight: 600, cursor: "pointer", marginBottom: 14, display: "inline-flex", alignItems: "center", gap: 6 }}>← All companies</div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 20, marginBottom: 22 }} className="flex-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: 15 }}>
          {company && <div style={{ width: 52, height: 52, borderRadius: 14, background: company.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{company.initials}</div>}
          <div>
            <h1 className="font-display" style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-.7px", margin: "0 0 5px", color: D.text }}>{company ? company.name : "Job roles"}</h1>
            <p style={{ fontSize: 15, color: D.text3, margin: 0 }}>{company ? `${company.industry} · ${(shown || []).length} open role${(shown || []).length === 1 ? "" : "s"}` : "Open a role to review applicants, or create a new one."}</p>
          </div>
        </div>
        <button onClick={() => navigate(companyId ? `/jobs/new?company=${companyId}` : "/jobs/new")} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 18px", background: GRAD, color: "#fff", border: "none", borderRadius: 11, fontWeight: 600, fontSize: 14, cursor: "pointer", boxShadow: "0 8px 20px rgba(99,102,241,.28)" }}>＋ Create role</button>
      </div>

      {/* summary stat cards (workspace-wide; hidden inside a single company) */}
      <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4" style={{ marginBottom: 26, display: companyId ? "none" : undefined }}>
        {summary.map((s) => (
          <div key={s.label} style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 14, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: s.accent + "1A", color: s.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{s.icon}</div>
            <div><div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.8px", lineHeight: 1, color: D.text }}>{s.value}</div><div style={{ fontSize: 12.5, color: D.text4, marginTop: 3, fontWeight: 500 }}>{s.label}</div></div>
          </div>
        ))}
      </div>

      {/* role cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))", gap: 18 }}>
        {jobs === null
          ? Array.from({ length: 3 }).map((_, i) => <div key={i} style={{ background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 18, height: 220 }} className="animate-pulse" />)
          : (shown || []).map((j, i) => {
              const acc = company ? { color: company.accent, bg: company.accent + "1A", avatar: company.accent } : ACCENTS[i % ACCENTS.length];
              const r = roleMap[j.job_id] || { applicants: 0, avg: 0, g: 0, a: 0, r: 0, avatars: [], more: 0 };
              const tot = Math.max(1, r.g + r.a + r.r);
              const needsReview = r.a > 0;
              const mono = j.role_title.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
              return (
                <div key={j.job_id} onClick={() => navigate(`/jobs/${j.job_id}/dashboard`)} style={{ position: "relative", background: D.cardBg, border: `0.5px solid ${D.border}`, borderRadius: 18, cursor: "pointer", overflow: "hidden" }} className="transition-all hover:-translate-y-0.5 hover:shadow-lg group">
                  <div style={{ height: 4, background: acc.color }} />
                  <button
                    onClick={(e) => deleteJob(e, j, r.applicants)}
                    title="Delete role"
                    style={{ position: "absolute", top: 12, right: 12, width: 26, height: 26, borderRadius: 8, background: D.cardBg, border: `0.5px solid ${D.border}`, color: D.text4, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, cursor: "pointer", transition: "color .15s, border-color .15s", zIndex: 1 }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = D.red; e.currentTarget.style.borderColor = D.red; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = D.text4; e.currentTarget.style.borderColor = D.border; }}
                  >✕</button>
                  <div style={{ padding: "22px 24px 24px" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
                      <div style={{ width: 46, height: 46, borderRadius: 13, background: acc.bg, color: acc.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, flexShrink: 0 }}>{mono}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 17.5, fontWeight: 700, letterSpacing: "-.3px", lineHeight: 1.25, marginBottom: 6, color: D.text }}>{j.role_title}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: acc.color, background: acc.bg, padding: "3px 9px", borderRadius: 6 }}>{j.industry}</span>
                          <span style={{ fontSize: 13, color: D.text4 }}>📍 {j.location}</span>
                        </div>
                      </div>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap", padding: "4px 10px", borderRadius: 20, ...(needsReview ? { color: D.amber, background: D.amberBg, border: `1px solid ${D.amberBorder}` } : { color: D.green, background: D.greenBg, border: `1px solid ${D.greenBorder}` }) }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: needsReview ? D.amber : D.green }} />{needsReview ? `${r.a} need review` : "On track"}
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                        <div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1, color: D.text }}>{r.applicants}</div><div style={{ fontSize: 12, color: D.text4, marginTop: 4 }}>applicants</div></div>
                        <div style={{ width: 1, height: 34, background: D.border }} />
                        <div><div style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-1.2px", lineHeight: 1, color: avgColor(r.avg) }}>{r.avg}</div><div style={{ fontSize: 12, color: D.text4, marginTop: 4 }}>avg score</div></div>
                      </div>
                      {r.avatars?.length > 0 && (
                        <div style={{ display: "flex", alignItems: "center" }}>
                          {r.avatars.map((ini, k) => <div key={k} style={{ width: 30, height: 30, borderRadius: "50%", background: avColor(ini + k), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, border: `2px solid ${D.cardBg}`, marginLeft: k ? -8 : 0 }}>{ini}</div>)}
                          {r.more > 0 && <div style={{ width: 30, height: 30, borderRadius: "50%", background: D.pillBg, color: D.text3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, border: `2px solid ${D.cardBg}`, marginLeft: -8 }}>+{r.more}</div>}
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", background: D.inset }}>
                      <div style={{ width: `${(r.g / tot) * 100}%`, background: D.green }} />
                      <div style={{ width: `${(r.a / tot) * 100}%`, background: D.amber }} />
                      <div style={{ width: `${(r.r / tot) * 100}%`, background: D.red }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 13 }}>
                      <div style={{ display: "flex", gap: 14, fontSize: 12.5, color: D.text3 }}><span><b style={{ color: D.green }}>{r.g}</b> strong</span><span><b style={{ color: D.amber }}>{r.a}</b> review</span><span><b style={{ color: D.red }}>{r.r}</b> gaps</span></div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: acc.color }}>View →</span>
                    </div>
                  </div>
                </div>
              );
            })}

        {jobs !== null && (
          <div onClick={() => navigate(companyId ? `/jobs/new?company=${companyId}` : "/jobs/new")} style={{ border: `1.5px dashed ${D.border}`, borderRadius: 18, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", cursor: "pointer", minHeight: 220 }} className="transition-colors hover:border-violet-300 hover:bg-violet-50/30">
            <div style={{ width: 46, height: 46, borderRadius: "50%", background: D.pillBg, color: D.text3, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 14 }}>＋</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: D.text2 }}>Create new role</div>
            <div style={{ fontSize: 13, color: D.text4, marginTop: 4, maxWidth: 180 }}>AI drafts the Success Profile from your job description</div>
          </div>
        )}
      </div>
    </div>
  );
}
